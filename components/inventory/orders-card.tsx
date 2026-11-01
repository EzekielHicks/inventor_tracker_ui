"use client";

import { useState } from "react";
import type { StockOrder } from "@/components/inventory/products";

type OrderFilter = "All" | "Outstanding" | "Received";

type OrdersCardProps = {
	orders: readonly StockOrder[];
	onReceive: (orderId: string) => void;
	onUpdateStatus: (orderId: string, status: StockOrder["status"]) => void;
};

const filters: OrderFilter[] = ["All", "Outstanding", "Received"];

function formatDate(value: string) {
	return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

export default function OrdersCard({ orders, onReceive, onUpdateStatus }: OrdersCardProps) {
	const [filter, setFilter] = useState<OrderFilter>("All");
	const visibleOrders = orders.filter((order) => {
		if (filter === "All") return true;
		if (filter === "Received") return order.status === "Received";
		return order.status !== "Received";
	});
	const outstandingUnits = orders
		.filter((order) => order.status !== "Received")
		.reduce((total, order) => total + order.quantity, 0);

	return (
		<section className="panel orders-panel">
			<div className="orders-heading">
				<div><h2>Stock orders</h2><p>Track ordered and received inventory</p></div>
				<strong className="orders-total">{outstandingUnits.toLocaleString()} units on order</strong>
			</div>
			<div className="order-filters" aria-label="Filter stock orders">
				{filters.map((item) => <button key={item} className={filter === item ? "order-filter-active" : ""} onClick={() => setFilter(item)}>{item}</button>)}
			</div>
			{visibleOrders.length === 0 ? (
				<div className="orders-empty">{orders.length === 0 ? "No stock orders yet." : `No ${filter.toLowerCase()} orders.`}</div>
			) : (
				<div className="orders-list">
					{visibleOrders.map((order) => (
						<article className="order-row" key={order.id}>
							<div className="order-product"><strong>{order.productName}</strong><span>{order.supplier}</span></div>
							<div className="order-quantity"><strong>{order.quantity.toLocaleString()}</strong><span>units</span></div>
							<div className="order-dates"><span>Ordered {formatDate(order.orderedAt)}</span>{order.receivedAt && <span>Received {formatDate(order.receivedAt)}</span>}</div>
							<span className={`order-status ${order.status === "Received" ? "order-received" : "order-pending"}`}>{order.status}</span>
							{order.status !== "Received" && <div className="order-actions">{order.status !== "Shipped" && <button className="update-order-button" onClick={() => onUpdateStatus(order.id, "Shipped")}>Mark shipped</button>}{order.status !== "Backorder" && <button className="update-order-button" onClick={() => onUpdateStatus(order.id, "Backorder")}>Backorder</button>}<button className="receive-order-button" onClick={() => onReceive(order.id)}>Mark received</button></div>}
						</article>
					))}
				</div>
			)}
		</section>
	);
}
