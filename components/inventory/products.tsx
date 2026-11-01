"use client";

import InventoryCard from "@/components/inventory/inventory-card";
import OrdersCard from "@/components/inventory/orders-card";

export default function Products({ includeOrders = true }: { includeOrders?: boolean }) {
	return (
		<>
			<InventoryCard />
			{includeOrders && <OrdersCard />}
		</>
	);
}
