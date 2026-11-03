"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useWorkspaceData } from "@/components/providers/workspace-data-provider";

export type Product = {
	name: string;
	category: string;
	stock: number;
	unitCost: number | null;
	lowStockThreshold: number | null;
	status: "In stock" | "Low stock" | "Out of stock";
	initials: string;
	color: string;
};

export type InventorySettings = {
	lowStockThresholdEnabled: boolean;
	defaultLowStockThreshold: number;
};

export type StockOrder = {
	id: string;
	productName: string;
	quantity: number;
	unitCost?: number | null;
	supplier: string;
	orderedAt: string;
	status: "Pending" | "Shipped" | "Backorder" | "Received";
	receivedAt?: string;
};

export type InventoryUsageItem = {
	productName: string;
	quantity: number;
	unitCost?: number | null;
};

export type InventoryUsageRecord = {
	id: string;
	recordedAt: string;
	recordedBy: string;
	recordedById?: string;
	items: InventoryUsageItem[];
};

type InventoryData = {
	products: Product[];
	orders: StockOrder[];
	usageRecords: InventoryUsageRecord[];
};

export const LOW_STOCK_THRESHOLD = 10;

type InventoryContextValue = {
	products: Product[];
	orders: StockOrder[];
	usageRecords: InventoryUsageRecord[];
	inventorySettings: InventorySettings;
	usageDialogOpen: boolean;
	stockOnHand: number;
	lowStockCount: number;
	outstandingOrderUnits: number;
	addProduct: (product: Omit<Product, "status" | "initials" | "color">) => Promise<void>;
	updateProduct: (currentName: string, product: Pick<Product, "name" | "category" | "unitCost" | "lowStockThreshold">) => Promise<void>;
	updateInventorySettings: (settings: InventorySettings) => Promise<void>;
	removeProduct: (productName: string) => Promise<void>;
	openUsageDialog: () => void;
	closeUsageDialog: () => void;
	updateStock: (productName: string, units: number) => Promise<void>;
	orderStock: (productName: string, units: number, supplier: string) => Promise<void>;
	recordUsage: (items: InventoryUsageItem[], recordedBy: string, recordedById: string) => Promise<void>;
	renameOrderSupplier: (oldName: string, newName: string) => Promise<void>;
	updateOrderStatus: (orderId: string, status: StockOrder["status"]) => Promise<void>;
	receiveOrder: (orderId: string) => Promise<boolean>;
};

const InventoryContext = createContext<InventoryContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isInventoryData(value: unknown): value is InventoryData {
	return isRecord(value) && Array.isArray(value.products) && Array.isArray(value.orders) && Array.isArray(value.usageRecords)
		&& value.products.every((product) => isRecord(product)
			&& typeof product.name === "string" && typeof product.category === "string"
			&& Number.isSafeInteger(product.stock) && Number(product.stock) >= 0
			&& (product.unitCost === null || typeof product.unitCost === "number")
			&& (product.lowStockThreshold === null || Number.isSafeInteger(product.lowStockThreshold))
			&& ["In stock", "Low stock", "Out of stock"].includes(String(product.status))
			&& typeof product.initials === "string" && typeof product.color === "string")
		&& value.orders.every((order) => isRecord(order)
			&& typeof order.id === "string" && typeof order.productName === "string"
			&& Number.isSafeInteger(order.quantity) && Number(order.quantity) > 0
			&& typeof order.supplier === "string" && typeof order.orderedAt === "string"
			&& ["Pending", "Shipped", "Backorder", "Received"].includes(String(order.status)))
		&& value.usageRecords.every((record) => isRecord(record)
			&& typeof record.id === "string" && typeof record.recordedAt === "string"
			&& typeof record.recordedBy === "string" && Array.isArray(record.items)
			&& record.items.every((item) => isRecord(item) && typeof item.productName === "string"
				&& Number.isSafeInteger(item.quantity) && Number(item.quantity) > 0));
}

function isInventorySettings(value: unknown): value is InventorySettings {
	return isRecord(value)
		&& typeof value.lowStockThresholdEnabled === "boolean"
		&& typeof value.defaultLowStockThreshold === "number"
		&& Number.isSafeInteger(value.defaultLowStockThreshold)
		&& value.defaultLowStockThreshold >= 1;
}

function getStockStatus(units: number, threshold: number | null, settings: InventorySettings): Product["status"] {
	if (units === 0) return "Out of stock";
	if (settings.lowStockThresholdEnabled && units <= (threshold ?? settings.defaultLowStockThreshold)) return "Low stock";
	return "In stock";
}

function getProductInitials(name: string) {
	const words = name.trim().split(/\s+/);
	return (words.length > 1 ? words.slice(0, 2).map((word) => word[0]).join("") : words[0].slice(0, 2)).toUpperCase();
}

export function InventoryProvider({ children }: { children: ReactNode }) {
	const { data, update } = useWorkspaceData();
	const [usageDialogOpen, setUsageDialogOpen] = useState(false);
	const inventoryValue = data.inventory?.value;
	const settingsValue = data.settings?.value;
	if (!isInventoryData(inventoryValue)) throw new Error("Shared inventory data is invalid.");
	if (!isInventorySettings(settingsValue)) throw new Error("Shared inventory settings are invalid.");
	const inventoryData = inventoryValue;
	const inventorySettings = settingsValue;
	const orderSequence = useMemo(() => ({ current: 0 }), []);

	const mutate = useCallback((updater: (current: InventoryData) => InventoryData) => update("inventory", (current) => {
		if (!isInventoryData(current)) throw new Error("Shared inventory data is invalid.");
		return updater(current);
	}), [update]);

	const addProduct = useCallback((product: Omit<Product, "status" | "initials" | "color">) => mutate((current) => {
		const name = product.name.trim();
		const category = product.category.trim();
		if (!name || !category) throw new Error("Product name and category are required.");
		if (!Number.isSafeInteger(product.stock) || product.stock < 0) throw new Error("Starting stock must be a non-negative whole number.");
		if (product.unitCost !== null && (!Number.isFinite(product.unitCost) || product.unitCost < 0)) throw new Error("Unit cost must be a non-negative amount.");
		if (product.lowStockThreshold !== null && (!Number.isSafeInteger(product.lowStockThreshold) || product.lowStockThreshold < 1)) throw new Error("Low-stock threshold must be a positive whole number.");
		if (current.products.some((item) => item.name.toLowerCase() === name.toLowerCase())) throw new Error("A product with this name already exists.");
		const colors = ["bg-blue-500", "bg-green-500", "bg-yellow-500", "bg-red-500", "bg-purple-500"];
		return { ...current, products: [...current.products, {
			name, category, stock: product.stock, unitCost: product.unitCost, lowStockThreshold: product.lowStockThreshold,
			status: getStockStatus(product.stock, product.lowStockThreshold, inventorySettings),
			initials: getProductInitials(name), color: colors[current.products.length % colors.length],
		}] };
	}), [inventorySettings, mutate]);

	const updateProduct = useCallback((currentName: string, product: Pick<Product, "name" | "category" | "unitCost" | "lowStockThreshold">) => mutate((current) => {
		const name = product.name.trim();
		const category = product.category.trim();
		if (!name || !category) throw new Error("Product name and category are required.");
		const existing = current.products.find((item) => item.name === currentName);
		if (!existing) throw new Error("This product no longer exists.");
		if (product.unitCost !== null && (!Number.isFinite(product.unitCost) || product.unitCost < 0)) throw new Error("Unit cost must be a non-negative amount.");
		if (product.lowStockThreshold !== null && (!Number.isSafeInteger(product.lowStockThreshold) || product.lowStockThreshold < 1)) throw new Error("Low-stock threshold must be a positive whole number.");
		if (current.products.some((item) => item.name !== currentName && item.name.toLowerCase() === name.toLowerCase())) throw new Error("A product with this name already exists.");
		return {
			...current,
			products: current.products.map((item) => item.name === currentName
				? { ...item, name, category, unitCost: product.unitCost, lowStockThreshold: product.lowStockThreshold, initials: getProductInitials(name) }
				: item),
			orders: currentName === name ? current.orders : current.orders.map((order) => order.productName === currentName ? { ...order, productName: name } : order),
			usageRecords: currentName === name ? current.usageRecords : current.usageRecords.map((record) => ({
				...record, items: record.items.map((item) => item.productName === currentName ? { ...item, productName: name } : item),
			})),
		};
	}), [mutate]);

	const updateInventorySettings = useCallback(async (settings: InventorySettings) => {
		if (!isInventorySettings(settings)) throw new Error("Choose a valid positive whole-number low-stock threshold.");
		await update("settings", () => settings);
	}, [update]);

	const removeProduct = useCallback((productName: string) => mutate((current) => {
		if (!current.products.some((item) => item.name === productName)) throw new Error("This product no longer exists.");
		if (current.orders.some((order) => order.productName === productName && order.status !== "Received")) throw new Error("This product has an outstanding stock order and cannot be removed yet.");
		return { ...current, products: current.products.filter((product) => product.name !== productName) };
	}), [mutate]);

	const openUsageDialog = useCallback(() => setUsageDialogOpen(true), []);
	const closeUsageDialog = useCallback(() => setUsageDialogOpen(false), []);

	const updateStock = useCallback((productName: string, units: number) => mutate((current) => {
		if (!Number.isSafeInteger(units) || units < 0) throw new Error("Stock must be a non-negative whole number.");
		if (!current.products.some((product) => product.name === productName)) throw new Error("This product no longer exists.");
		return { ...current, products: current.products.map((product) => product.name === productName
			? { ...product, stock: units, status: getStockStatus(units, product.lowStockThreshold, inventorySettings) }
			: product) };
	}), [inventorySettings, mutate]);

	const orderStock = useCallback((productName: string, units: number, supplier: string) => mutate((current) => {
		if (!Number.isSafeInteger(units) || units <= 0) throw new Error("Order quantity must be a positive whole number.");
		const product = current.products.find((item) => item.name === productName);
		if (!product) throw new Error("This product no longer exists.");
		orderSequence.current += 1;
		const order: StockOrder = {
			id: `${Date.now()}-${orderSequence.current}`,
			productName, quantity: units, unitCost: product.unitCost, supplier,
			orderedAt: new Date().toISOString(), status: "Pending",
		};
		return { ...current, orders: [...current.orders, order] };
	}), [mutate, orderSequence]);

	const recordUsage = useCallback((items: InventoryUsageItem[], recordedBy: string, recordedById: string) => mutate((current) => {
		if (items.length === 0) throw new Error("Add at least one item to the usage list.");
		const quantitiesByProduct = new Map<string, number>();
		items.forEach(({ productName, quantity }) => {
			if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error("Usage quantities must be positive whole numbers.");
			const total = (quantitiesByProduct.get(productName) ?? 0) + quantity;
			if (!Number.isSafeInteger(total)) throw new Error(`Usage quantity for ${productName} is too large.`);
			quantitiesByProduct.set(productName, total);
		});
		quantitiesByProduct.forEach((quantity, productName) => {
			const product = current.products.find((item) => item.name === productName);
			if (!product) throw new Error(`Product "${productName}" is no longer in inventory.`);
			if (quantity > product.stock) throw new Error(`Only ${product.stock} ${product.stock === 1 ? "unit is" : "units are"} available for ${productName}.`);
		});
		const record: InventoryUsageRecord = {
			id: crypto.randomUUID(), recordedAt: new Date().toISOString(), recordedBy, recordedById,
			items: Array.from(quantitiesByProduct, ([productName, quantity]) => ({
				productName, quantity, unitCost: current.products.find((product) => product.name === productName)?.unitCost ?? null,
			})),
		};
		return {
			...current,
			products: current.products.map((product) => {
				const used = quantitiesByProduct.get(product.name) ?? 0;
				const stock = product.stock - used;
				return used ? { ...product, stock, status: getStockStatus(stock, product.lowStockThreshold, inventorySettings) } : product;
			}),
			usageRecords: [record, ...current.usageRecords],
		};
	}), [inventorySettings, mutate]);

	const renameOrderSupplier = useCallback((oldName: string, newName: string) => mutate((current) => ({
		...current,
		orders: current.orders.map((order) => order.supplier === oldName ? { ...order, supplier: newName } : order),
	})), [mutate]);

	const updateOrderStatus = useCallback((orderId: string, status: StockOrder["status"]) => mutate((current) => ({
		...current,
		orders: current.orders.map((order) => order.id !== orderId || order.status === "Received" ? order
			: { ...order, status, ...(status === "Received" ? { receivedAt: new Date().toISOString() } : {}) }),
	})), [mutate]);

	const receiveOrder = useCallback(async (orderId: string) => {
		let received = false;
		await mutate((current) => {
			const order = current.orders.find((item) => item.id === orderId && item.status !== "Received");
			const product = order && current.products.find((item) => item.name === order.productName);
			if (!order || !product) return current;
			received = true;
			const status = "Received" as const;
			return {
				...current,
				products: current.products.map((item) => item.name === product.name
					? { ...item, stock: item.stock + order.quantity, status: getStockStatus(item.stock + order.quantity, item.lowStockThreshold, inventorySettings) }
					: item),
				orders: current.orders.map((item) => item.id === order.id ? { ...item, status, receivedAt: new Date().toISOString() } : item),
			};
		});
		return received;
	}, [inventorySettings, mutate]);

	const statusProducts = useMemo(() => inventoryData.products.map((product) => ({
		...product, status: getStockStatus(product.stock, product.lowStockThreshold, inventorySettings),
	})), [inventoryData.products, inventorySettings]);
	const value = useMemo(() => ({
		products: statusProducts,
		orders: inventoryData.orders,
		usageRecords: inventoryData.usageRecords,
		inventorySettings,
		usageDialogOpen,
		stockOnHand: statusProducts.reduce((total, product) => total + product.stock, 0),
		lowStockCount: statusProducts.filter((product) => product.status === "Low stock").length,
		outstandingOrderUnits: inventoryData.orders.filter((order) => order.status !== "Received").reduce((total, order) => total + order.quantity, 0),
		addProduct, updateProduct, updateInventorySettings, removeProduct, openUsageDialog, closeUsageDialog, updateStock,
		orderStock, recordUsage, renameOrderSupplier, updateOrderStatus, receiveOrder,
	}), [statusProducts, inventoryData, inventorySettings, usageDialogOpen, addProduct, updateProduct, updateInventorySettings, removeProduct, openUsageDialog, closeUsageDialog, updateStock, orderStock, recordUsage, renameOrderSupplier, updateOrderStatus, receiveOrder]);

	return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
	const context = useContext(InventoryContext);
	if (!context) throw new Error("useInventory must be used within an InventoryProvider.");
	return context;
}
