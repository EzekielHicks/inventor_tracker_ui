"use client";

import { useState } from "react";
import { useInventory } from "@/components/providers/inventory-provider";
import { useUsers } from "@/components/providers/user-provider";
import { useNotify } from "@/components/layout/workspace-shell";

type OrderFilter = "All" | "Outstanding" | "Received";

const filters: OrderFilter[] = ["All", "Outstanding", "Received"];

function formatDate(value: string) {
	return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

export default function OrdersCard() {
	const { orders, receiveOrder, updateOrderStatus } = useInventory();
	const { canManageInventory } = useUsers();
	const notify = useNotify();
	const [filter, setFilter] = useState<OrderFilter>("All");
	const visibleOrders = orders.filter((order) => {
		if (filter === "All") return true;
		if (filter === "Received") return order.status === "Received";
		return order.status !== "Received";
	});
	const outstandingUnits = orders
		.filter((order) => order.status !== "Received")
		.reduce((total, order) => total + order.quantity, 0);
	const updateStatus = async (orderId: string, status: "Shipped" | "Backorder") => {
		try {
			await updateOrderStatus(orderId, status);
			notify(`Order marked as ${status.toLowerCase()}.`);
		} catch (error) {
			notify(error instanceof Error ? error.message : "Could not update the order.");
		}
	};
	const receive = async (orderId: string, productName: string, quantity: number) => {
		try {
			if (await receiveOrder(orderId)) notify(`${quantity} ${quantity === 1 ? "unit" : "units"} of ${productName} marked as received.`);
			else notify(`Could not receive the order for ${productName}.`);
		} catch (error) {
			notify(error instanceof Error ? error.message : "Could not receive the order.");
		}
	};

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
						<article className={`order-row${canManageInventory && order.status !== "Received" ? "" : " order-row-readonly"}`} key={order.id}>
							<div className="order-product"><strong>{order.productName}</strong>{canManageInventory && <span>{order.supplier}</span>}</div>
							<div className="order-quantity"><strong>{order.quantity.toLocaleString()}</strong><span>units</span></div>
							<div className="order-dates"><span>Ordered {formatDate(order.orderedAt)}</span>{order.receivedAt && <span>Received {formatDate(order.receivedAt)}</span>}</div>
							<span className={`order-status order-${order.status.toLowerCase()}`}>{order.status}</span>
							{canManageInventory && order.status !== "Received" && <div className="order-actions">{order.status !== "Shipped" && <button className="update-order-button" onClick={() => void updateStatus(order.id, "Shipped")}>Mark shipped</button>}{order.status !== "Backorder" && <button className="update-order-button" onClick={() => void updateStatus(order.id, "Backorder")}>Backorder</button>}<button className="receive-order-button" onClick={() => void receive(order.id, order.productName, order.quantity)}>Mark received</button></div>}
						</article>
					))}
				</div>
			)}
		</section>
	);
}
