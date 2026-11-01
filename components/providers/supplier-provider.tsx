"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";

export type Supplier = {
	id: string;
	name: string;
	email: string;
	phone: string;
	website: string;
};

export type SourcingSite = {
	id: string;
	name: string;
	type: "search" | "api";
	url: string;
};

export type SourcingRequest = {
	id: string;
	supplierId?: string;
	supplierName?: string;
	productName: string;
	quantity: number;
	siteId: string;
	siteName: string;
	requesterId: string;
	requesterName: string;
	createdAt: string;
	status: "Pending review" | "Sourcing approved" | "Approved" | "Rejected" | "Submitted";
	reviewedBy?: string;
};

type SupplierState = {
	suppliers: Supplier[];
	sites: SourcingSite[];
	requests: SourcingRequest[];
};

type SupplierContextValue = SupplierState & {
	addSupplier: (supplier: Omit<Supplier, "id">) => void;
	updateSupplier: (id: string, supplier: Omit<Supplier, "id">) => void;
	deleteSupplier: (id: string) => void;
	addSite: (site: Omit<SourcingSite, "id">) => void;
	updateSite: (id: string, site: Omit<SourcingSite, "id">) => void;
	deleteSite: (id: string) => void;
	renameRequestedProduct: (oldName: string, newName: string) => void;
	requestSourcing: (request: Omit<SourcingRequest, "id" | "createdAt" | "status" | "siteName" | "supplierName">) => void;
	requestSourcingBatch: (requests: Omit<SourcingRequest, "id" | "createdAt" | "status" | "siteName" | "supplierName">[]) => void;
	markRequestSubmitted: (id: string) => void;
};

const STORAGE_KEY = "stockroom.supplierWorkspace";
const CHANGE_EVENT = "stockroom-supplier-workspace-change";
const initialState: SupplierState = {
	suppliers: [
		{ id: "acme", name: "Acme Supplies", email: "", phone: "", website: "" },
		{ id: "northstar", name: "Northstar Wholesale", email: "", phone: "", website: "" },
		{ id: "direct", name: "Direct Purchase", email: "", phone: "", website: "" },
	],
	sites: [
		{ id: "amazon-search", name: "Amazon search", type: "search", url: "https://www.amazon.com/s?k={query}" },
	],
	requests: [],
};
let stateSnapshot = initialState;
let initialized = false;

const SupplierContext = createContext<SupplierContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isSupplierState(value: unknown): value is SupplierState {
	return isRecord(value)
		&& Array.isArray(value.suppliers)
		&& value.suppliers.every((item) => isRecord(item) && typeof item.id === "string" && typeof item.name === "string" && typeof item.email === "string" && typeof item.phone === "string" && typeof item.website === "string")
		&& Array.isArray(value.sites)
		&& value.sites.every((item) => isRecord(item) && typeof item.id === "string" && typeof item.name === "string" && (item.type === "search" || item.type === "api") && typeof item.url === "string")
		&& Array.isArray(value.requests)
		&& value.requests.every((item) => isRecord(item) && typeof item.id === "string" && (item.supplierId === undefined || typeof item.supplierId === "string") && (item.supplierName === undefined || typeof item.supplierName === "string") && typeof item.productName === "string" && typeof item.quantity === "number" && (item.siteId === undefined || typeof item.siteId === "string") && (item.siteName === undefined || typeof item.siteName === "string") && typeof item.requesterId === "string" && typeof item.requesterName === "string" && typeof item.createdAt === "string" && ["Pending review", "Sourcing approved", "Approved", "Rejected", "Submitted"].includes(String(item.status)));
}

function migrateSupplierState(value: SupplierState): SupplierState {
	return {
		...value,
		requests: value.requests.map((request) => ({
			...request,
			siteId: request.siteId ?? "",
			siteName: request.siteName || "No web search",
			status: request.status === "Sourcing approved" || request.status === "Approved" ? "Pending review" : request.status,
		})),
	};
}

function loadState() {
	if (initialized || typeof window === "undefined") return;
	initialized = true;
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (!saved) return;
		const parsed: unknown = JSON.parse(saved);
		if (isSupplierState(parsed)) {
			stateSnapshot = migrateSupplierState(parsed);
			if (stateSnapshot.requests.some((request, index) => request.siteId !== parsed.requests[index].siteId
				|| request.siteName !== parsed.requests[index].siteName
				|| request.status !== parsed.requests[index].status)) {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(stateSnapshot));
			}
		} else {
			console.error("Saved supplier workspace data is invalid; using the defaults.");
		}
	} catch (error) {
		console.error("Could not load supplier workspace data.", error);
	}
}

function subscribe(callback: () => void) {
	if (typeof window === "undefined") return () => {};
	const onStorage = (event: StorageEvent) => {
		if (event.key !== STORAGE_KEY) return;
		initialized = false;
		stateSnapshot = initialState;
		loadState();
		callback();
	};
	window.addEventListener("storage", onStorage);
	window.addEventListener(CHANGE_EVENT, callback);
	return () => {
		window.removeEventListener("storage", onStorage);
		window.removeEventListener(CHANGE_EVENT, callback);
	};
}

function getSnapshot() {
	loadState();
	return stateSnapshot;
}

function saveState(nextState: SupplierState) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
		stateSnapshot = nextState;
		window.dispatchEvent(new Event(CHANGE_EVENT));
	} catch (error) {
		console.error("Could not save supplier workspace data.", error);
		throw error;
	}
}

function validatedHttpsUrl(value: string, label: string) {
	const parsed = new URL(value);
	if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
		throw new Error(`${label} must be an HTTPS URL without embedded credentials.`);
	}
	return parsed.href;
}

function validatePhoneNumber(value: string) {
	if (value && (!/^[+\d().\-\s]+$/.test(value) || value.replace(/\D/g, "").length < 7 || value.replace(/\D/g, "").length > 15)) {
		throw new Error("Phone number must contain 7 to 15 digits and only phone number characters.");
	}
}

export function buildSiteUrl(site: SourcingSite, productName: string) {
	if (site.type !== "search" || !site.url || !site.url.includes("{query}")) {
		throw new Error("This site does not have a usable search URL template.");
	}
	const safeTemplate = validatedHttpsUrl(site.url.replace("{query}", encodeURIComponent(productName)), "Search URL");
	return safeTemplate;
}

export function SupplierProvider({ children }: { children: ReactNode }) {
	const state = useSyncExternalStore(subscribe, getSnapshot, () => initialState);
	const addSupplier = useCallback((supplier: Omit<Supplier, "id">) => {
		validatePhoneNumber(supplier.phone);
		if (stateSnapshot.suppliers.some((item) => item.name.toLowerCase() === supplier.name.trim().toLowerCase())) {
			throw new Error("A supplier with this name already exists.");
		}
		saveState({ ...getSnapshot(), suppliers: [...getSnapshot().suppliers, { ...supplier, name: supplier.name.trim(), id: crypto.randomUUID() }] });
	}, []);
	const updateSupplier = useCallback((id: string, supplier: Omit<Supplier, "id">) => {
		validatePhoneNumber(supplier.phone);
		if (stateSnapshot.suppliers.some((item) => item.id !== id && item.name.toLowerCase() === supplier.name.trim().toLowerCase())) {
			throw new Error("A supplier with this name already exists.");
		}
		const current = getSnapshot();
		if (!current.suppliers.some((item) => item.id === id)) throw new Error("The supplier no longer exists.");
		saveState({ ...current, suppliers: current.suppliers.map((item) => item.id === id ? { ...supplier, name: supplier.name.trim(), id } : item) });
	}, []);
	const deleteSupplier = useCallback((id: string) => {
		const current = getSnapshot();
		if (!current.suppliers.some((item) => item.id === id)) throw new Error("The supplier no longer exists.");
		if (current.requests.some((request) => request.supplierId === id)) {
			throw new Error("This supplier is referenced by a sourcing request and cannot be removed.");
		}
		saveState({ ...current, suppliers: current.suppliers.filter((item) => item.id !== id) });
	}, []);
	const saveSite = useCallback((id: string | null, site: Omit<SourcingSite, "id">) => {
		const url = site.url.trim();
		if (!site.name.trim()) throw new Error("A sourcing template name is required.");
		if (site.type === "search" && url) {
			if (!url.includes("{query}")) throw new Error("Search URL must include a {query} placeholder.");
			validatedHttpsUrl(url.replace("{query}", "test"), "Search URL");
		} else if (site.type === "api" && url) {
			validatedHttpsUrl(url, "API endpoint");
		}
		const current = getSnapshot();
		const duplicate = current.sites.some((item) => item.id !== id && item.name.toLowerCase() === site.name.trim().toLowerCase());
		if (duplicate) throw new Error("A site with this name already exists.");
		if (id && !current.sites.some((item) => item.id === id)) throw new Error("The site no longer exists.");
		saveState({
			...current,
			sites: id
				? current.sites.map((item) => item.id === id ? { ...site, name: site.name.trim(), url, id } : item)
				: [...current.sites, { ...site, name: site.name.trim(), url, id: crypto.randomUUID() }],
		});
	}, []);
	const addSite = useCallback((site: Omit<SourcingSite, "id">) => saveSite(null, site), [saveSite]);
	const updateSite = useCallback((id: string, site: Omit<SourcingSite, "id">) => saveSite(id, site), [saveSite]);
	const deleteSite = useCallback((id: string) => {
		const current = getSnapshot();
		if (current.requests.some((request) => request.siteId === id)) throw new Error("This site is referenced by a sourcing request and cannot be removed.");
		saveState({ ...current, sites: current.sites.filter((site) => site.id !== id) });
	}, []);
	const renameRequestedProduct = useCallback((oldName: string, newName: string) => {
		const current = getSnapshot();
		if (!current.requests.some((request) => request.productName === oldName)) return;
		saveState({
			...current,
			requests: current.requests.map((request) => request.productName === oldName ? { ...request, productName: newName } : request),
		});
	}, []);
	const requestSourcingBatch = useCallback((requests: Omit<SourcingRequest, "id" | "createdAt" | "status" | "siteName" | "supplierName">[]) => {
		if (!requests.length) throw new Error("Add at least one product to the order request.");
		const current = getSnapshot();
		const createdAt = new Date().toISOString();
		const newRequests = requests.map((request) => {
			if (!Number.isSafeInteger(request.quantity) || request.quantity < 1) throw new Error("Request quantity must be a positive whole number.");
			const supplier = current.suppliers.find((item) => item.id === request.supplierId);
			if (!supplier) throw new Error("Choose a valid supplier for each requested product.");
			const site = request.siteId
				? current.sites.find((item) => item.id === request.siteId && item.type === "search")
				: undefined;
			if (request.siteId && !site) throw new Error("Choose a configured web search site or leave it blank.");
			return { ...request, siteId: site?.id ?? "", supplierName: supplier.name, siteName: site?.name ?? "No web search", id: crypto.randomUUID(), createdAt, status: "Pending review" as const };
		});
		saveState({ ...current, requests: [...newRequests, ...current.requests] });
	}, []);
	const requestSourcing = useCallback((request: Omit<SourcingRequest, "id" | "createdAt" | "status" | "siteName" | "supplierName">) => requestSourcingBatch([request]), [requestSourcingBatch]);
	const markRequestSubmitted = useCallback((id: string) => {
		const current = getSnapshot();
		const request = current.requests.find((item) => item.id === id);
		if (!request || !["Pending review", "Sourcing approved", "Approved"].includes(request.status)) {
			throw new Error("This request is no longer open.");
		}
		saveState({ ...current, requests: current.requests.map((item) => item.id === id ? { ...item, status: "Submitted" } : item) });
	}, []);
	const value = useMemo(() => ({
		...state,
		addSupplier,
		updateSupplier,
		deleteSupplier,
		addSite,
		updateSite,
		deleteSite,
		renameRequestedProduct,
		requestSourcing,
		requestSourcingBatch,
		markRequestSubmitted,
	}), [state, addSupplier, updateSupplier, deleteSupplier, addSite, updateSite, deleteSite, renameRequestedProduct, requestSourcing, requestSourcingBatch, markRequestSubmitted]);

	return <SupplierContext.Provider value={value}>{children}</SupplierContext.Provider>;
}

export function useSuppliers() {
	const context = useContext(SupplierContext);
	if (!context) throw new Error("useSuppliers must be used within SupplierProvider.");
	return context;
}
