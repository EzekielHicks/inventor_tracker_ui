"use client";

import Link from "next/link";
import CategoryBreakdownCard from "@/components/dashboard/category-breakdown-card";
import StatCard from "@/components/dashboard/stat-card";
import StockOverviewCard from "@/components/dashboard/stock-overview-card";
import { useInventory } from "@/components/providers/inventory-provider";
import { useUsers } from "@/components/providers/user-provider";
import PageTemplate from "@/components/templates/page-template";
import Products from "@/components/inventory/products";
import Icon from "@/components/ui/icon";
import { useNotify } from "@/components/layout/workspace-shell";

export default function OverviewApp() {
	const { activeUser, canManageInventory } = useUsers();
	const { products, stockOnHand, lowStockCount, outstandingOrderUnits, openUsageDialog } = useInventory();
	const notify = useNotify();
	return (
		<PageTemplate
			eyebrow="WORKSPACE OVERVIEW"
			title={`Good morning, ${activeUser.name.split(" ")[0]}`}
			description="Here’s what’s happening with your inventory today."
			action={canManageInventory
				? <Link className="primary-button" href="/inventory">Edit products <Icon name="chevron" size={15} /></Link>
				: <button className="primary-button" disabled={!products.some((product) => product.stock > 0)} onClick={openUsageDialog}>Record usage <Icon name="plus" size={15} /></button>}
		>
			<div className="stats-grid">
				<StatCard title="Items on Order" value={outstandingOrderUnits.toLocaleString()} tone="purple" icon={<Icon name="box" size={17} />} detail="units currently on order" />
				<StatCard title="Stock on hand" value={stockOnHand.toLocaleString()} tone="green" icon={<span className="stock-symbol">↗</span>} detail="available units" />
				<StatCard title="Low stock items" value={lowStockCount.toLocaleString()} tone="amber" icon={<span className="alert-mark">!</span>} detail="need attention" />
				<StatCard title="Products" value={products.length.toLocaleString()} tone="blue" icon={<span className="dollar">#</span>} detail="tracked in inventory" />
			</div>
			<div className="middle-grid">
				<StockOverviewCard notify={notify} />
				<CategoryBreakdownCard products={products} notify={notify} />
			</div>
			<Products />
		</PageTemplate>
	);
}
