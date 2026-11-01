"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import CategoryBreakdownCard from "@/components/dashboard/category-breakdown-card";
import InventoryCard from "@/components/inventory/inventory-card";
import OrdersCard from "@/components/inventory/orders-card";
import Icon from "@/components/ui/icon";
import StatCard from "@/components/dashboard/stat-card";

export type Product = {
	name: string;
	category: string;
	stock: number;
	status: "In stock" | "Low stock" | "Out of stock";
	initials: string;
	color: string;
};

export type StockOrder = {
	id: string;
	productName: string;
	quantity: number;
	supplier: string;
	orderedAt: string;
	status: "Pending" | "Shipped" | "Backorder" | "Received";
	receivedAt?: string;
};

const initialProducts: Product[] = [
	{ name: "60 Port USB Hub", category: "USB Hub", stock: 25, status: "In stock", initials: "HB", color: "bg-blue-500" },
	{ name: "Rack Shelves", category: "Materials", stock: 10, status: "Low stock", initials: "RS", color: "bg-green-500" },
	{ name: "Rack Nuts", category: "Materials", stock: 0, status: "Out of stock", initials: "RN", color: "bg-yellow-500" },
	{ name: "Type-C Charger\"", category: "Cables", stock: 5, status: "Low stock", initials: "TC", color: "bg-red-500" },
	{ name: "Lightning Cable", category: "Cables", stock: 50, status: "In stock", initials: "LC", color: "bg-purple-500" },
];

type ProductsProps = {
	notify: (message: string) => void;
	children: ReactNode;
};

const LOW_STOCK_THRESHOLD = 10;

function getStockStatus(units: number): Product["status"] {
	if (units === 0) return "Out of stock";
	if (units <= LOW_STOCK_THRESHOLD) return "Low stock";
	return "In stock";
}

export default function Products({ notify, children }: ProductsProps) {
	const [inventory, setInventory] = useState(initialProducts);
	const [orders, setOrders] = useState<StockOrder[]>([]);
	const orderSequence = useRef(0);
	const stockOnHand = useMemo(() => inventory.reduce((total, product) => total + product.stock, 0), [inventory]);
	const lowStockCount = useMemo(() => inventory.filter((product) => product.status === "Low stock").length, [inventory]);
	const outstandingOrderUnits = useMemo(
		() => orders.filter((order) => order.status !== "Received").reduce((total, order) => total + order.quantity, 0),
		[orders],
	);

	const updateStock = (productName: string, units: number) => {
		setInventory((currentInventory) => currentInventory.map((product) => (
			product.name === productName
				? { ...product, stock: units, status: getStockStatus(units) }
				: product
		)));
	};

	const orderStock = (productName: string, units: number, supplier: string) => {
		orderSequence.current += 1;
		setOrders((currentOrders) => [...currentOrders, {
			id: `${Date.now()}-${orderSequence.current}`,
			productName,
			quantity: units,
			supplier,
			orderedAt: new Date().toISOString(),
			status: "Pending",
		}]);
		notify(`Order placed for ${units} ${units === 1 ? "unit" : "units"} of ${productName} from ${supplier}.`);
	};

	const updateOrderStatus = (orderId: string, status: StockOrder["status"]) => {
		setOrders((currentOrders) => currentOrders.map((order) => {
			if (order.id !== orderId || order.status === "Received") return order;
			return {
				...order,
				status,
				...(status === "Received" ? { receivedAt: new Date().toISOString() } : {}),
			};
		}));
	};

	const receiveOrder = (orderId: string) => {
		const order = orders.find((item) => item.id === orderId && item.status !== "Received");
		if (!order) return;

		const product = inventory.find((item) => item.name === order.productName);
		if (!product) {
			notify(`Could not receive the order: ${order.productName} is no longer in inventory.`);
			return;
		}

		updateStock(order.productName, product.stock + order.quantity);
		updateOrderStatus(order.id, "Received");
		notify(`${order.quantity} ${order.quantity === 1 ? "unit" : "units"} of ${order.productName} marked as received.`);
	};

	return (
		<>
			<div className="stats-grid">
				<StatCard title="Items on Order" value={outstandingOrderUnits.toLocaleString()} tone="purple" icon={<Icon name="box" size={17} />} detail="units currently on order" />
				<StatCard title="Stock on hand" value={stockOnHand.toLocaleString()} tone="green" icon={<span className="stock-symbol">↗</span>} detail="available units" />
				<StatCard title="Low stock items" value={lowStockCount.toLocaleString()} tone="amber" icon={<span className="alert-mark">!</span>} detail={`at or below ${LOW_STOCK_THRESHOLD} units`} />
				<StatCard title="Inventory Used" value="200" tone="blue" icon={<span className="dollar">$</span>} trend={{ value: "4.6%", direction: "up" }} detail="vs. last month" />
			</div>
			<div className="middle-grid">
				{children}
				<CategoryBreakdownCard products={inventory} notify={notify} />
			</div>
			<InventoryCard
				products={inventory}
				orders={orders}
				lowStockThreshold={LOW_STOCK_THRESHOLD}
				onUpdateStock={updateStock}
				onOrderStock={orderStock}
				notify={notify}
			/>
			<OrdersCard orders={orders} onReceive={receiveOrder} onUpdateStatus={updateOrderStatus} />
		</>
	);
}
