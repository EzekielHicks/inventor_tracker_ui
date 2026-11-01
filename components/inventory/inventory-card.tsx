"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Product, StockOrder } from "@/components/inventory/products";
import Icon from "@/components/ui/icon";

type InventoryFilter = "All items" | Product["status"];

type InventoryCardProps = {
	products: readonly Product[];
	orders: readonly StockOrder[];
	lowStockThreshold: number;
	onUpdateStock: (productName: string, units: number) => void;
	onOrderStock: (productName: string, units: number, supplier: string) => void;
	notify: (message: string) => void;
};

const suppliers = ["Acme Supplies", "Northstar Wholesale", "Direct Purchase"];

export default function InventoryCard({ products, orders, lowStockThreshold, onUpdateStock, onOrderStock, notify }: InventoryCardProps) {
	const [query, setQuery] = useState("");
	const [activeFilter, setActiveFilter] = useState<InventoryFilter>("All items");
	const [openOptionsFor, setOpenOptionsFor] = useState<string | null>(null);
	const [dialogProduct, setDialogProduct] = useState<Product | null>(null);
	const [dialogMode, setDialogMode] = useState<"edit" | "order" | null>(null);
	const [draftUnits, setDraftUnits] = useState("");
	const [selectedSupplier, setSelectedSupplier] = useState("");

	const filteredProducts = useMemo(() => products.filter((product) => {
		const matchesQuery = `${product.name} ${product.category}`.toLowerCase().includes(query.toLowerCase());
		const matchesFilter = activeFilter === "All items" || product.status === activeFilter;
		return matchesQuery && matchesFilter;
	}), [products, query, activeFilter]);
	const lowStockCount = useMemo(() => products.filter((product) => product.status === "Low stock").length, [products]);
	const orderSummaryByProduct = useMemo(() => {
		const summary = new Map<string, { units: number; statuses: StockOrder["status"][] }>();
		orders.forEach((order) => {
			const current = summary.get(order.productName) ?? { units: 0, statuses: [] };
			if (order.status !== "Received") current.units += order.quantity;
			if (!current.statuses.includes(order.status)) current.statuses.push(order.status);
			summary.set(order.productName, current);
		});
		return summary;
	}, [orders]);

	useEffect(() => {
		if (!dialogProduct) return;

		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") setDialogProduct(null);
		};
		window.addEventListener("keydown", closeOnEscape);
		return () => window.removeEventListener("keydown", closeOnEscape);
	}, [dialogProduct]);

	const saveDialog = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!dialogProduct || !dialogMode || draftUnits.trim() === "") return;

		const units = Number(draftUnits);
		if (!Number.isSafeInteger(units) || units < (dialogMode === "order" ? 1 : 0)) return;

		if (dialogMode === "edit") {
			onUpdateStock(dialogProduct.name, units);
			notify(`${dialogProduct.name} quantity updated`);
		} else {
			if (!selectedSupplier) return;
			onOrderStock(dialogProduct.name, units, selectedSupplier);
		}
		setDialogProduct(null);
		setDialogMode(null);
	};

	return (
		<>
			<section className="panel products-panel">
				<div className="products-heading">
					<div><h2>Products</h2><p>Current Inventory</p></div>
					<button className="text-button" onClick={() => { setActiveFilter("All items"); setQuery(""); notify("Showing all inventory"); }}>View all inventory <Icon name="chevron" size={15} /></button>
				</div>
				<div className="table-tools">
					<div className="filter-tabs">
						{(["All items", "Low stock", "Out of stock"] as InventoryFilter[]).map((filter) => (
							<button key={filter} className={activeFilter === filter ? "filter-active" : ""} onClick={() => setActiveFilter(filter)}>
								{filter}{filter === "Low stock" && <span className="tab-count">{lowStockCount}</span>}
							</button>
						))}
					</div>
					<div className="table-actions">
						<label className="search-box"><Icon name="search" size={16}/><input aria-label="Search inventory" placeholder="Search products..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
						<button className="filter-button" onClick={() => notify("Filters are up to date")}><Icon name="filter" size={16}/> Filter</button>
						<button className="export-button" onClick={() => notify("Your inventory export is being prepared")}><Icon name="download" size={16}/> Export</button>
					</div>
				</div>
				<div className="table-scroll">
					<table>
						<thead><tr><th>PRODUCT</th><th>CATEGORY</th><th>STOCK</th><th>ON ORDER</th><th>SHIPPING STATUS</th><th>STATUS</th><th><span className="sr-only">Options</span></th></tr></thead>
						<tbody>{filteredProducts.map((product) => {
							const optionsId = `options-${product.name.replaceAll(" ", "-")}`;
							return (
								<tr key={product.name}>
									<td><div className="product-cell"><div className={`product-thumb ${product.color}`}>{product.initials}</div><div><strong>{product.name}</strong></div></div></td>
									<td>{product.category}</td>
									<td><strong className="stock-number">{product.stock}</strong> <span className="units">units</span></td>
									<td><strong className="stock-number">{(orderSummaryByProduct.get(product.name)?.units ?? 0).toLocaleString()}</strong> <span className="units">units</span></td>
									<td><div className="product-shipping-status">{orderSummaryByProduct.get(product.name)?.statuses.length ? orderSummaryByProduct.get(product.name)?.statuses.map((status) => <span className={`order-status order-${status.toLowerCase()}`} key={status}>{status}</span>) : <span className="units">—</span>}</div></td>
									<td><span className={`status-badge ${product.status.toLowerCase().replaceAll(" ", "-")}`}><i/>{product.status}</span></td>
									<td>
										<div className="inventory-actions">
											<button className="row-more" aria-label={`Options for ${product.name}`} aria-expanded={openOptionsFor === product.name} aria-controls={optionsId} onClick={() => setOpenOptionsFor(openOptionsFor === product.name ? null : product.name)}><Icon name="more" size={18}/></button>
											{openOptionsFor === product.name && <div className="inventory-options" id={optionsId}><button onClick={() => { setDraftUnits(String(product.stock)); setDialogProduct(product); setDialogMode("edit"); setOpenOptionsFor(null); }}>Edit unit amount</button><button onClick={() => { setDraftUnits(""); setSelectedSupplier(""); setDialogProduct(product); setDialogMode("order"); setOpenOptionsFor(null); }}>Order more stock</button></div>}
										</div>
									</td>
								</tr>
							);
						})}</tbody>
					</table>
					{filteredProducts.length === 0 && <div className="empty-state">No products match your search.</div>}
				</div>
				<div className="table-footer">
					<span>Showing <strong>{filteredProducts.length ? 1 : 0}–{filteredProducts.length}</strong> of <strong>{filteredProducts.length}</strong> products</span>
					<div className="pagination"><button disabled aria-label="Previous page">‹</button><button className="page-current">1</button><button onClick={() => notify("You’re viewing the latest products")}>2</button><button onClick={() => notify("You’re viewing the latest products")}>3</button><span>...</span><button onClick={() => notify("You’re viewing the latest products")}>12</button><button aria-label="Next page" onClick={() => notify("You’re viewing the latest products")}>›</button></div>
				</div>
			</section>

			{dialogProduct && dialogMode && <div className="edit-units-overlay"><section className="edit-units-dialog" role="dialog" aria-modal="true" aria-labelledby="inventory-dialog-title"><h2 id="inventory-dialog-title">{dialogMode === "edit" ? "Edit unit amount" : "Order more stock"}</h2><p>{dialogProduct.name}</p><form onSubmit={saveDialog}><label htmlFor="unit-amount">{dialogMode === "edit" ? "Units in stock" : "Amount to order"}</label><input id="unit-amount" type="number" min={dialogMode === "edit" ? 0 : 1} max={Number.MAX_SAFE_INTEGER} step="1" required autoFocus value={draftUnits} onChange={(event) => setDraftUnits(event.target.value)} />{dialogMode === "edit" ? <small>Status updates automatically: 0 is Out of stock, up to {lowStockThreshold} is Low stock.</small> : <><label htmlFor="stock-supplier">Supplier</label><select id="stock-supplier" required value={selectedSupplier} onChange={(event) => setSelectedSupplier(event.target.value)}><option value="" disabled>Select a supplier</option>{suppliers.map((supplier) => <option key={supplier} value={supplier}>{supplier}</option>)}</select><small>Ordered units will be added to available stock when received.</small></>}<div className="edit-units-actions"><button type="button" className="cancel-edit" onClick={() => { setDialogProduct(null); setDialogMode(null); }}>Cancel</button><button type="submit" className="save-edit">{dialogMode === "edit" ? "Save amount" : "Place order"}</button></div></form></section></div>}
		</>
	);
}
