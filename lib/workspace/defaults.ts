export const defaultInventoryData = {
	products: [
		{ name: "60 Port USB Hub", category: "USB Hub", stock: 25, unitCost: null, lowStockThreshold: null, status: "In stock", initials: "HB", color: "bg-blue-500" },
		{ name: "Rack Shelves", category: "Materials", stock: 10, unitCost: null, lowStockThreshold: null, status: "Low stock", initials: "RS", color: "bg-green-500" },
		{ name: "Rack Nuts", category: "Materials", stock: 0, unitCost: null, lowStockThreshold: null, status: "Out of stock", initials: "RN", color: "bg-yellow-500" },
		{ name: "Type-C Charger\"", category: "Cables", stock: 5, unitCost: null, lowStockThreshold: null, status: "Low stock", initials: "TC", color: "bg-red-500" },
		{ name: "Lightning Cable", category: "Cables", stock: 50, unitCost: null, lowStockThreshold: null, status: "In stock", initials: "LC", color: "bg-purple-500" },
	],
	orders: [],
	usageRecords: [],
};

export const defaultInventorySettings = {
	lowStockThresholdEnabled: true,
	defaultLowStockThreshold: 10,
};

export const defaultSupplierData = {
	suppliers: [
		{ id: "acme", name: "Acme Supplies", email: "", phone: "", website: "" },
		{ id: "northstar", name: "Northstar Wholesale", email: "", phone: "", website: "" },
		{ id: "direct", name: "Direct Purchase", email: "", phone: "", website: "" },
	],
	sites: [
		{ id: "amazon-search", name: "Amazon search", type: "search" as const, url: "https://www.amazon.com/s?k={query}" },
	],
	requests: [],
};
