"use client";

import CategoryBreakdownCard from "@/components/dashboard/category-breakdown-card";
import { useInventory } from "@/components/providers/inventory-provider";
import { useNotify } from "@/components/layout/workspace-shell";
import PageTemplate from "@/components/templates/page-template";
import StatCard from "@/components/dashboard/stat-card";
import Icon from "@/components/ui/icon";

export default function AnalyticsApp() {
	const { products, orders, stockOnHand, outstandingOrderUnits, lowStockCount } = useInventory();
	const notify = useNotify();
	const shippedOrders = orders.filter((order) => order.status === "Shipped").length;
	const receivedOrders = orders.filter((order) => order.status === "Received").length;
	const backorderedOrders = orders.filter((order) => order.status === "Backorder").length;

	return (
		<PageTemplate
			eyebrow="WORKSPACE / ANALYTICS"
			title="Analytics"
			description="A live summary of your stock levels and incoming orders."
		>
			<div className="stats-grid">
				<StatCard title="Stock on hand" value={stockOnHand.toLocaleString()} tone="green" icon={<span className="stock-symbol">↗</span>} detail="available units" />
				<StatCard title="Items on Order" value={outstandingOrderUnits.toLocaleString()} tone="purple" icon={<Icon name="box" size={17} />} detail="incoming units" />
				<StatCard title="Low stock items" value={lowStockCount.toLocaleString()} tone="amber" icon={<span className="alert-mark">!</span>} detail="need attention" />
				<StatCard title="Products" value={products.length.toLocaleString()} tone="blue" icon={<span className="dollar">#</span>} detail="tracked items" />
			</div>
			<div className="analytics-grid">
				<CategoryBreakdownCard products={products} notify={notify} />
				<section className="panel analytics-shipping">
					<div className="panel-heading"><div><h2>Order shipping</h2><p>Current order status breakdown</p></div></div>
					<div className="shipping-summary">
						<div><span className="order-status order-pending">Pending</span><strong>{orders.filter((order) => order.status === "Pending").length}</strong></div>
						<div><span className="order-status order-shipped">Shipped</span><strong>{shippedOrders}</strong></div>
						<div><span className="order-status order-backorder">Backorder</span><strong>{backorderedOrders}</strong></div>
						<div><span className="order-status order-received">Received</span><strong>{receivedOrders}</strong></div>
					</div>
				</section>
			</div>
			<section className="panel analytics-attention">
				<div className="panel-heading"><div><h2>Items to review</h2><p>Products with low or empty stock</p></div></div>
				{products.filter((product) => product.status !== "In stock").length === 0
					? <p className="analytics-empty">All products have healthy stock levels.</p>
					: <div className="attention-list">{products.filter((product) => product.status !== "In stock").map((product) => <div key={product.name}><span>{product.name}</span><strong>{product.stock} units · {product.status}</strong></div>)}</div>}
			</section>
		</PageTemplate>
	);
}
