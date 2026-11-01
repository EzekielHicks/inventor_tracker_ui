"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

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
	items: InventoryUsageItem[];
};

export const LOW_STOCK_THRESHOLD = 10;
const INVENTORY_SETTINGS_KEY = "stockroom.inventorySettings";
const INVENTORY_SETTINGS_CHANGE_EVENT = "stockroom-inventory-settings-change";
const defaultInventorySettings: InventorySettings = {
	lowStockThresholdEnabled: true,
	defaultLowStockThreshold: LOW_STOCK_THRESHOLD,
};
let inventorySettingsSnapshot = defaultInventorySettings;
let inventorySettingsInitialized = false;
const initialProducts: Product[] = [
	{ name: "60 Port USB Hub", category: "USB Hub", stock: 25, unitCost: null, lowStockThreshold: null, status: "In stock", initials: "HB", color: "bg-blue-500" },
	{ name: "Rack Shelves", category: "Materials", stock: 10, unitCost: null, lowStockThreshold: null, status: "Low stock", initials: "RS", color: "bg-green-500" },
	{ name: "Rack Nuts", category: "Materials", stock: 0, unitCost: null, lowStockThreshold: null, status: "Out of stock", initials: "RN", color: "bg-yellow-500" },
	{ name: "Type-C Charger\"", category: "Cables", stock: 5, unitCost: null, lowStockThreshold: null, status: "Low stock", initials: "TC", color: "bg-red-500" },
	{ name: "Lightning Cable", category: "Cables", stock: 50, unitCost: null, lowStockThreshold: null, status: "In stock", initials: "LC", color: "bg-purple-500" },
];
const productColors = ["bg-blue-500", "bg-green-500", "bg-yellow-500", "bg-red-500", "bg-purple-500"];

type InventoryContextValue = {
	products: Product[];
	orders: StockOrder[];
	usageRecords: InventoryUsageRecord[];
	inventorySettings: InventorySettings;
	usageDialogOpen: boolean;
	stockOnHand: number;
	lowStockCount: number;
	outstandingOrderUnits: number;
	addProduct: (product: Omit<Product, "status" | "initials" | "color">) => void;
	updateProduct: (currentName: string, product: Pick<Product, "name" | "category" | "unitCost" | "lowStockThreshold">) => void;
	updateInventorySettings: (settings: InventorySettings) => void;
	removeProduct: (productName: string) => void;
	openUsageDialog: () => void;
	closeUsageDialog: () => void;
	updateStock: (productName: string, units: number) => void;
	orderStock: (productName: string, units: number, supplier: string) => void;
	recordUsage: (items: InventoryUsageItem[], recordedBy: string) => void;
	renameOrderSupplier: (oldName: string, newName: string) => void;
	updateOrderStatus: (orderId: string, status: StockOrder["status"]) => void;
	receiveOrder: (orderId: string) => boolean;
};

const InventoryContext = createContext<InventoryContextValue | null>(null);

function isInventorySettings(value: unknown): value is InventorySettings {
	return typeof value === "object" && value !== null
		&& "lowStockThresholdEnabled" in value && typeof value.lowStockThresholdEnabled === "boolean"
		&& "defaultLowStockThreshold" in value && typeof value.defaultLowStockThreshold === "number"
		&& Number.isSafeInteger(value.defaultLowStockThreshold) && value.defaultLowStockThreshold >= 1;
}

function getInventorySettingsSnapshot() {
	if (!inventorySettingsInitialized && typeof window !== "undefined") {
		inventorySettingsInitialized = true;
		inventorySettingsSnapshot = defaultInventorySettings;
		try {
			const saved = localStorage.getItem(INVENTORY_SETTINGS_KEY);
			if (saved) {
				const parsed: unknown = JSON.parse(saved);
				if (isInventorySettings(parsed)) inventorySettingsSnapshot = parsed;
				else console.error("Saved inventory settings are invalid; using the recommended defaults.");
			}
		} catch (error) {
			console.error("Could not load inventory settings.", error);
		}
	}
	return inventorySettingsSnapshot;
}

function subscribeToInventorySettings(callback: () => void) {
	const onStorageChange = (event: StorageEvent) => {
		if (event.key !== INVENTORY_SETTINGS_KEY) return;
		inventorySettingsInitialized = false;
		getInventorySettingsSnapshot();
		callback();
	};
	window.addEventListener("storage", onStorageChange);
	window.addEventListener(INVENTORY_SETTINGS_CHANGE_EVENT, callback);
	return () => {
		window.removeEventListener("storage", onStorageChange);
		window.removeEventListener(INVENTORY_SETTINGS_CHANGE_EVENT, callback);
	};
}

function getStockStatus(units: number, threshold: number | null, settings: InventorySettings): Product["status"] {
	if (units === 0) return "Out of stock";
	if (settings.lowStockThresholdEnabled && units <= (threshold ?? settings.defaultLowStockThreshold)) return "Low stock";
	return "In stock";
}

function getProductInitials(name: string) {
	const words = name.trim().split(/\s+/);
	return (words.length > 1
		? words.slice(0, 2).map((word) => word[0]).join("")
		: words[0].slice(0, 2)).toUpperCase();
}

export function InventoryProvider({ children }: { children: ReactNode }) {
	const [products, setProducts] = useState(initialProducts);
	const [orders, setOrders] = useState<StockOrder[]>([]);
	const [usageRecords, setUsageRecords] = useState<InventoryUsageRecord[]>([]);
	const [usageDialogOpen, setUsageDialogOpen] = useState(false);
	const inventorySettings = useSyncExternalStore(subscribeToInventorySettings, getInventorySettingsSnapshot, () => defaultInventorySettings);
	const orderSequence = useRef(0);

	const addProduct = useCallback((product: Omit<Product, "status" | "initials" | "color">) => {
		const name = product.name.trim();
		const category = product.category.trim();
		if (!name || !category) throw new Error("Product name and category are required.");
		if (!Number.isSafeInteger(product.stock) || product.stock < 0) throw new Error("Starting stock must be a non-negative whole number.");
		if (product.unitCost !== null && (!Number.isFinite(product.unitCost) || product.unitCost < 0)) throw new Error("Unit cost must be a non-negative amount.");
		if (product.lowStockThreshold !== null && (!Number.isSafeInteger(product.lowStockThreshold) || product.lowStockThreshold < 1)) throw new Error("Low-stock threshold must be a positive whole number.");
		if (products.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
			throw new Error("A product with this name already exists.");
		}
		setProducts((current) => [...current, {
			name,
			category,
			stock: product.stock,
			unitCost: product.unitCost,
			lowStockThreshold: product.lowStockThreshold,
			status: getStockStatus(product.stock, product.lowStockThreshold, inventorySettings),
			initials: getProductInitials(name),
			color: productColors[current.length % productColors.length],
		}]);
	}, [inventorySettings, products]);

	const updateProduct = useCallback((currentName: string, product: Pick<Product, "name" | "category" | "unitCost" | "lowStockThreshold">) => {
		const name = product.name.trim();
		const category = product.category.trim();
		if (!name || !category) throw new Error("Product name and category are required.");
		const current = products.find((item) => item.name === currentName);
		if (!current) throw new Error("This product no longer exists.");
		if (product.unitCost !== null && (!Number.isFinite(product.unitCost) || product.unitCost < 0)) throw new Error("Unit cost must be a non-negative amount.");
		if (product.lowStockThreshold !== null && (!Number.isSafeInteger(product.lowStockThreshold) || product.lowStockThreshold < 1)) throw new Error("Low-stock threshold must be a positive whole number.");
		if (products.some((item) => item.name !== currentName && item.name.toLowerCase() === name.toLowerCase())) {
			throw new Error("A product with this name already exists.");
		}
		setProducts((items) => items.map((item) => item.name === currentName
			? { ...item, name, category, unitCost: product.unitCost, lowStockThreshold: product.lowStockThreshold, status: getStockStatus(item.stock, product.lowStockThreshold, inventorySettings), initials: getProductInitials(name) }
			: item));
		if (currentName !== name) {
			setOrders((items) => items.map((order) => order.productName === currentName ? { ...order, productName: name } : order));
			setUsageRecords((records) => records.map((record) => ({
				...record,
				items: record.items.map((item) => item.productName === currentName ? { ...item, productName: name } : item),
			})));
		}
	}, [inventorySettings, products]);

	const updateInventorySettings = useCallback((settings: InventorySettings) => {
		if (!isInventorySettings(settings)) throw new Error("Choose a valid positive whole-number low-stock threshold.");
		try {
			localStorage.setItem(INVENTORY_SETTINGS_KEY, JSON.stringify(settings));
		} catch (error) {
			console.error("Could not save inventory settings.", error);
			throw new Error("Could not save inventory settings in this browser.");
		}
		inventorySettingsSnapshot = settings;
		inventorySettingsInitialized = true;
		window.dispatchEvent(new Event(INVENTORY_SETTINGS_CHANGE_EVENT));
	}, []);

	const removeProduct = useCallback((productName: string) => {
		if (!products.some((item) => item.name === productName)) throw new Error("This product no longer exists.");
		if (orders.some((order) => order.productName === productName && order.status !== "Received")) {
			throw new Error("This product has an outstanding stock order and cannot be removed yet.");
		}
		setProducts((current) => current.filter((product) => product.name !== productName));
	}, [orders, products]);

	const openUsageDialog = useCallback(() => setUsageDialogOpen(true), []);
	const closeUsageDialog = useCallback(() => setUsageDialogOpen(false), []);

	const updateStock = useCallback((productName: string, units: number) => {
		setProducts((current) => current.map((product) => product.name === productName
			? { ...product, stock: units, status: getStockStatus(units, product.lowStockThreshold, inventorySettings) }
			: product));
	}, [inventorySettings]);

	const orderStock = useCallback((productName: string, units: number, supplier: string) => {
		orderSequence.current += 1;
		setOrders((current) => [...current, {
			id: `${Date.now()}-${orderSequence.current}`,
			productName,
			quantity: units,
			unitCost: products.find((product) => product.name === productName)?.unitCost ?? null,
			supplier,
			orderedAt: new Date().toISOString(),
			status: "Pending",
		}]);
	}, [products]);

	const recordUsage = useCallback((items: InventoryUsageItem[], recordedBy: string) => {
		if (items.length === 0) throw new Error("Add at least one item to the usage list.");
		const quantitiesByProduct = new Map<string, number>();
		items.forEach(({ productName, quantity }) => {
			if (!Number.isSafeInteger(quantity) || quantity <= 0) {
				throw new Error("Usage quantities must be positive whole numbers.");
			}
			const total = (quantitiesByProduct.get(productName) ?? 0) + quantity;
			if (!Number.isSafeInteger(total)) {
				throw new Error(`Usage quantity for ${productName} is too large.`);
			}
			quantitiesByProduct.set(productName, total);
		});
		quantitiesByProduct.forEach((quantity, productName) => {
			const product = products.find((item) => item.name === productName);
			if (!product) throw new Error(`Product "${productName}" is no longer in inventory.`);
			if (quantity > product.stock) {
				throw new Error(`Only ${product.stock} ${product.stock === 1 ? "unit is" : "units are"} available for ${productName}.`);
			}
		});

		setProducts((current) => current.map((product) => {
			const used = quantitiesByProduct.get(product.name) ?? 0;
			const stock = product.stock - used;
			return used ? { ...product, stock, status: getStockStatus(stock, product.lowStockThreshold, inventorySettings) } : product;
		}));
		setUsageRecords((current) => [{
			id: `${Date.now()}-${++orderSequence.current}`,
			recordedAt: new Date().toISOString(),
			recordedBy,
			items: Array.from(quantitiesByProduct, ([productName, quantity]) => ({
				productName,
				quantity,
				unitCost: products.find((product) => product.name === productName)?.unitCost ?? null,
			})),
		}, ...current]);
	}, [inventorySettings, products]);

	const renameOrderSupplier = useCallback((oldName: string, newName: string) => {
		setOrders((current) => current.map((order) => order.supplier === oldName ? { ...order, supplier: newName } : order));
	}, []);

	const updateOrderStatus = useCallback((orderId: string, status: StockOrder["status"]) => {
		setOrders((current) => current.map((order) => {
			if (order.id !== orderId || order.status === "Received") return order;
			return { ...order, status, ...(status === "Received" ? { receivedAt: new Date().toISOString() } : {}) };
		}));
	}, []);

	const receiveOrder = useCallback((orderId: string) => {
		const order = orders.find((item) => item.id === orderId && item.status !== "Received");
		if (!order) return false;
		const product = products.find((item) => item.name === order.productName);
		if (!product) return false;

		updateStock(order.productName, product.stock + order.quantity);
		updateOrderStatus(order.id, "Received");
		return true;
	}, [orders, products, updateOrderStatus, updateStock]);

	const statusProducts = useMemo(() => products.map((product) => ({
		...product,
		status: getStockStatus(product.stock, product.lowStockThreshold, inventorySettings),
	})), [products, inventorySettings]);
	const value = useMemo(() => ({
		products: statusProducts,
		orders,
		usageRecords,
		inventorySettings,
		usageDialogOpen,
		stockOnHand: statusProducts.reduce((total, product) => total + product.stock, 0),
		lowStockCount: statusProducts.filter((product) => product.status === "Low stock").length,
		outstandingOrderUnits: orders.filter((order) => order.status !== "Received").reduce((total, order) => total + order.quantity, 0),
		addProduct,
		updateProduct,
		updateInventorySettings,
		removeProduct,
		openUsageDialog,
		closeUsageDialog,
		updateStock,
		orderStock,
		recordUsage,
		renameOrderSupplier,
		updateOrderStatus,
		receiveOrder,
	}), [statusProducts, orders, usageRecords, inventorySettings, usageDialogOpen, addProduct, updateProduct, updateInventorySettings, removeProduct, openUsageDialog, closeUsageDialog, updateStock, orderStock, recordUsage, renameOrderSupplier, updateOrderStatus, receiveOrder]);

	return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
	const context = useContext(InventoryContext);
	if (!context) throw new Error("useInventory must be used within an InventoryProvider.");
	return context;
}
