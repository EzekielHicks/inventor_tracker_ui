"use client";

import Products from "@/components/inventory/products";
import PageTemplate from "@/components/templates/page-template";
import { useInventory } from "@/components/providers/inventory-provider";

export default function InventoryApp() {
	const { products } = useInventory();

	return (
		<PageTemplate
			eyebrow="WORKSPACE / INVENTORY"
			title="Inventory"
			description={`${products.length} products tracked across your inventory.`}
		>
			<Products />
		</PageTemplate>
	);
}
