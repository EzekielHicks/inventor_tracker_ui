"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { defaultInventoryData, defaultInventorySettings, defaultSupplierData } from "@/lib/workspace/defaults";
import { createClient } from "@/lib/supabase/client";

type DataKey = "inventory" | "suppliers" | "settings";
type VersionedData = { value: unknown; version: number };
type WorkspaceData = Partial<Record<DataKey, VersionedData>>;
type WorkspaceDataContextValue = {
	ready: boolean;
	data: WorkspaceData;
	update: (key: DataKey, updater: (current: unknown) => unknown) => Promise<void>;
};

const WorkspaceDataContext = createContext<WorkspaceDataContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function responseJson(response: Response) {
	const result: unknown = await response.json();
	if (!response.ok) {
		const message = isRecord(result) && typeof result.message === "string" ? result.message : "Could not load shared workspace data.";
		throw new Error(message);
	}
	return result;
}

function readLegacyState(key: string) {
	try {
		const stored = localStorage.getItem(key);
		return stored ? JSON.parse(stored) as unknown : null;
	} catch (error) {
		console.error(`Could not read saved browser data for ${key}.`, error);
		return null;
	}
}

function readLegacyString(key: string) {
	try {
		return localStorage.getItem(key);
	} catch (error) {
		console.error(`Could not read the saved browser value for ${key}.`, error);
		return null;
	}
}

function isStoredSupplierState(value: unknown) {
	return isRecord(value)
		&& Array.isArray(value.suppliers)
		&& value.suppliers.every((item) => isRecord(item) && typeof item.id === "string" && typeof item.name === "string" && typeof item.email === "string" && typeof item.phone === "string" && typeof item.website === "string")
		&& Array.isArray(value.sites)
		&& value.sites.every((item) => isRecord(item) && typeof item.id === "string" && typeof item.name === "string" && (item.type === "search" || item.type === "api") && typeof item.url === "string")
		&& Array.isArray(value.requests)
		&& value.requests.every((item) => isRecord(item) && typeof item.id === "string" && typeof item.productName === "string" && typeof item.quantity === "number" && typeof item.requesterId === "string" && typeof item.requesterName === "string" && typeof item.createdAt === "string" && ["Pending review", "Sourcing approved", "Approved", "Rejected", "Submitted"].includes(String(item.status)));
}

function getInitialImport() {
	const oldSettings = readLegacyState("stockroom.inventorySettings");
	const oldSupplierData = readLegacyState("stockroom.supplierWorkspace");
	const oldUsers = readLegacyState("stockroom.users");
	const activeUserId = readLegacyString("stockroom.activeUser");
	const settings = isRecord(oldSettings)
		&& typeof oldSettings.lowStockThresholdEnabled === "boolean"
		&& Number.isSafeInteger(oldSettings.defaultLowStockThreshold)
		&& Number(oldSettings.defaultLowStockThreshold) > 0
		? oldSettings
		: defaultInventorySettings;
	const suppliers = isStoredSupplierState(oldSupplierData)
		? oldSupplierData
		: defaultSupplierData;
	return {
		inventory: defaultInventoryData,
		settings,
		suppliers,
		legacy_profiles: { users: Array.isArray(oldUsers) ? oldUsers : [], activeUserId },
	};
}

export function WorkspaceDataProvider({ children }: { children: ReactNode }) {
	const [data, setData] = useState<WorkspaceData>({});
	const [ready, setReady] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
	const [attempt, setAttempt] = useState(0);
	const dataRef = useRef<WorkspaceData>({});
	const queues = useRef<Partial<Record<DataKey, Promise<void>>>>({});

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			try {
				let response = await fetch("/api/workspace", { cache: "no-store" });
				let result = await responseJson(response);
				if (!isRecord(result) || !isRecord(result.data)) throw new Error("The shared workspace response is invalid.");
				if (Object.keys(result.data).length === 0) {
					const importResponse = await fetch("/api/workspace/import", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(getInitialImport()),
					});
					if (importResponse.status === 409) {
						response = await fetch("/api/workspace", { cache: "no-store" });
						result = await responseJson(response);
					} else {
						await responseJson(importResponse);
						response = await fetch("/api/workspace", { cache: "no-store" });
						result = await responseJson(response);
						for (const key of ["stockroom.inventorySettings", "stockroom.supplierWorkspace", "stockroom.users", "stockroom.activeUser"]) {
							localStorage.removeItem(key);
						}
					}
				}
				if (!isRecord(result) || !isRecord(result.data)) throw new Error("The shared workspace response is invalid.");
				const loaded: WorkspaceData = {};
				for (const key of ["inventory", "suppliers", "settings"] as const) {
					const entry = result.data[key];
					if (isRecord(entry) && "value" in entry && Number.isSafeInteger(entry.version)) {
						loaded[key] = { value: entry.value, version: Number(entry.version) };
					}
				}
				if (!loaded.inventory || !loaded.suppliers || !loaded.settings) {
					throw new Error("Shared workspace data is incomplete. Ask an admin to restore the workspace.");
				}
				if (!cancelled) {
					dataRef.current = loaded;
					setData(loaded);
					setReady(true);
				}
			} catch (error) {
				console.error("Could not initialize the shared workspace.", error);
				if (!cancelled) setErrorMessage(error instanceof Error ? error.message : "Could not initialize the shared workspace.");
			}
		};
		void load();
		const channel = createClient().channel("shared-workspace-data").on(
			"postgres_changes",
			{ event: "*", schema: "public", table: "workspace_data" },
			(payload) => {
				const row = payload.new;
				if (!isRecord(row) || typeof row.data_key !== "string" || !["inventory", "suppliers", "settings"].includes(row.data_key)
					|| !Number.isSafeInteger(row.version) || !("data" in row)) return;
				const key = row.data_key as DataKey;
				const current = dataRef.current[key];
				if (current && Number(row.version) > current.version) {
					const updated = { ...dataRef.current, [key]: { value: row.data, version: Number(row.version) } };
					dataRef.current = updated;
					setData(updated);
				}
			},
		).subscribe();
		return () => {
			cancelled = true;
			void createClient().removeChannel(channel);
		};
	}, [attempt]);

	const update = useCallback((key: DataKey, updater: (current: unknown) => unknown) => {
		const previousQueue = queues.current[key] ?? Promise.resolve();
		const nextQueue = previousQueue.then(async () => {
			const current = dataRef.current[key];
			if (!current) throw new Error("Shared workspace data is not loaded.");
			const value = updater(current.value);
			const response = await fetch("/api/workspace", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ key, value, expectedVersion: current.version }),
			});
			const result = await responseJson(response);
			if (!isRecord(result) || !Number.isSafeInteger(result.version)) throw new Error("The workspace save response is invalid.");
			const next = { value, version: Number(result.version) };
			const updated = { ...dataRef.current, [key]: next };
			dataRef.current = updated;
			setData(updated);
		});
		queues.current[key] = nextQueue.catch(() => {});
		return nextQueue;
	}, []);

	return <WorkspaceDataContext.Provider value={{ ready, data, update }}>
		{ready ? children : errorMessage
			? <main className="workspace-loading"><section className="panel"><h1>Could not load the shared workspace</h1><p role="alert">{errorMessage}</p><button className="primary-button" type="button" onClick={() => { setErrorMessage(""); setAttempt((value) => value + 1); }}>Try again</button></section></main>
			: <main className="workspace-loading" role="status">Loading shared workspace…</main>}
	</WorkspaceDataContext.Provider>;
}

export function useWorkspaceData() {
	const context = useContext(WorkspaceDataContext);
	if (!context) throw new Error("useWorkspaceData must be used within WorkspaceDataProvider.");
	return context;
}
