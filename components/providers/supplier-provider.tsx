"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useWorkspaceData } from "@/components/providers/workspace-data-provider";

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
	addSupplier: (supplier: Omit<Supplier, "id">) => Promise<void>;
	updateSupplier: (id: string, supplier: Omit<Supplier, "id">) => Promise<void>;
	deleteSupplier: (id: string) => Promise<void>;
	addSite: (site: Omit<SourcingSite, "id">) => Promise<void>;
	updateSite: (id: string, site: Omit<SourcingSite, "id">) => Promise<void>;
	deleteSite: (id: string) => Promise<void>;
	renameRequestedProduct: (oldName: string, newName: string) => Promise<void>;
	requestSourcing: (request: Omit<SourcingRequest, "id" | "createdAt" | "status" | "siteName" | "supplierName">) => Promise<void>;
	requestSourcingBatch: (requests: Omit<SourcingRequest, "id" | "createdAt" | "status" | "siteName" | "supplierName">[]) => Promise<void>;
	markRequestSubmitted: (id: string) => Promise<void>;
};

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
	return validatedHttpsUrl(site.url.replace("{query}", encodeURIComponent(productName)), "Search URL");
}

export function SupplierProvider({ children }: { children: ReactNode }) {
	const { data, update } = useWorkspaceData();
	const supplierValue = data.suppliers?.value;
	if (!isSupplierState(supplierValue)) throw new Error("Shared supplier data is invalid.");
	const state = migrateSupplierState(supplierValue);
	const mutate = useCallback((updater: (current: SupplierState) => SupplierState) => update("suppliers", (current) => {
		if (!isSupplierState(current)) throw new Error("Shared supplier data is invalid.");
		return updater(current);
	}), [update]);

	const addSupplier = useCallback((supplier: Omit<Supplier, "id">) => mutate((current) => {
		validatePhoneNumber(supplier.phone);
		const name = supplier.name.trim();
		if (!name) throw new Error("A supplier name is required.");
		if (current.suppliers.some((item) => item.name.toLowerCase() === name.toLowerCase())) throw new Error("A supplier with this name already exists.");
		return { ...current, suppliers: [...current.suppliers, { ...supplier, name, id: crypto.randomUUID() }] };
	}), [mutate]);

	const updateSupplier = useCallback((id: string, supplier: Omit<Supplier, "id">) => mutate((current) => {
		validatePhoneNumber(supplier.phone);
		const name = supplier.name.trim();
		if (!name) throw new Error("A supplier name is required.");
		if (current.suppliers.some((item) => item.id !== id && item.name.toLowerCase() === name.toLowerCase())) throw new Error("A supplier with this name already exists.");
		if (!current.suppliers.some((item) => item.id === id)) throw new Error("The supplier no longer exists.");
		return { ...current, suppliers: current.suppliers.map((item) => item.id === id ? { ...supplier, name, id } : item) };
	}), [mutate]);

	const deleteSupplier = useCallback((id: string) => mutate((current) => {
		if (!current.suppliers.some((item) => item.id === id)) throw new Error("The supplier no longer exists.");
		if (current.requests.some((request) => request.supplierId === id)) throw new Error("This supplier is referenced by a sourcing request and cannot be removed.");
		return { ...current, suppliers: current.suppliers.filter((item) => item.id !== id) };
	}), [mutate]);

	const saveSite = useCallback((id: string | null, site: Omit<SourcingSite, "id">) => mutate((current) => {
		const url = site.url.trim();
		const name = site.name.trim();
		if (!name) throw new Error("A sourcing template name is required.");
		if (site.type === "search" && url) {
			if (!url.includes("{query}")) throw new Error("Search URL must include a {query} placeholder.");
			validatedHttpsUrl(url.replace("{query}", "test"), "Search URL");
		} else if (site.type === "api" && url) validatedHttpsUrl(url, "API endpoint");
		if (current.sites.some((item) => item.id !== id && item.name.toLowerCase() === name.toLowerCase())) throw new Error("A site with this name already exists.");
		if (id && !current.sites.some((item) => item.id === id)) throw new Error("The site no longer exists.");
		return { ...current, sites: id
			? current.sites.map((item) => item.id === id ? { ...site, name, url, id } : item)
			: [...current.sites, { ...site, name, url, id: crypto.randomUUID() }] };
	}), [mutate]);
	const addSite = useCallback((site: Omit<SourcingSite, "id">) => saveSite(null, site), [saveSite]);
	const updateSite = useCallback((id: string, site: Omit<SourcingSite, "id">) => saveSite(id, site), [saveSite]);

	const deleteSite = useCallback((id: string) => mutate((current) => {
		if (current.requests.some((request) => request.siteId === id)) throw new Error("This site is referenced by a sourcing request and cannot be removed.");
		return { ...current, sites: current.sites.filter((site) => site.id !== id) };
	}), [mutate]);

	const renameRequestedProduct = useCallback((oldName: string, newName: string) => mutate((current) => ({
		...current,
		requests: current.requests.map((request) => request.productName === oldName ? { ...request, productName: newName } : request),
	})), [mutate]);

	const requestSourcingBatch = useCallback((requests: Omit<SourcingRequest, "id" | "createdAt" | "status" | "siteName" | "supplierName">[]) => mutate((current) => {
		if (!requests.length) throw new Error("Add at least one product to the order request.");
		const createdAt = new Date().toISOString();
		const newRequests = requests.map((request) => {
			if (!Number.isSafeInteger(request.quantity) || request.quantity < 1) throw new Error("Request quantity must be a positive whole number.");
			const supplier = current.suppliers.find((item) => item.id === request.supplierId);
			if (!supplier) throw new Error("Choose a valid supplier for each requested product.");
			const site = request.siteId ? current.sites.find((item) => item.id === request.siteId && item.type === "search") : undefined;
			if (request.siteId && !site) throw new Error("Choose a configured web search site or leave it blank.");
			return { ...request, siteId: site?.id ?? "", supplierName: supplier.name, siteName: site?.name ?? "No web search", id: crypto.randomUUID(), createdAt, status: "Pending review" as const };
		});
		return { ...current, requests: [...newRequests, ...current.requests] };
	}), [mutate]);

	const requestSourcing = useCallback((request: Omit<SourcingRequest, "id" | "createdAt" | "status" | "siteName" | "supplierName">) => requestSourcingBatch([request]), [requestSourcingBatch]);

	const markRequestSubmitted = useCallback((id: string) => mutate((current) => {
		const request = current.requests.find((item) => item.id === id);
		if (!request || !["Pending review", "Sourcing approved", "Approved"].includes(request.status)) throw new Error("This request is no longer open.");
		return { ...current, requests: current.requests.map((item) => item.id === id ? { ...item, status: "Submitted" } : item) };
	}), [mutate]);

	const value = useMemo(() => ({
		...state,
		addSupplier, updateSupplier, deleteSupplier, addSite, updateSite, deleteSite,
		renameRequestedProduct, requestSourcing, requestSourcingBatch, markRequestSubmitted,
	}), [state, addSupplier, updateSupplier, deleteSupplier, addSite, updateSite, deleteSite, renameRequestedProduct, requestSourcing, requestSourcingBatch, markRequestSubmitted]);

	return <SupplierContext.Provider value={value}>{children}</SupplierContext.Provider>;
}

export function useSuppliers() {
	const context = useContext(SupplierContext);
	if (!context) throw new Error("useSuppliers must be used within SupplierProvider.");
	return context;
}
