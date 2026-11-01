"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { LOW_STOCK_THRESHOLD, useInventory, type Product, type StockOrder } from "@/components/providers/inventory-provider";
import { useSuppliers } from "@/components/providers/supplier-provider";
import { useUsers } from "@/components/providers/user-provider";
import { useNotify } from "@/components/layout/workspace-shell";
import Icon from "@/components/ui/icon";

type InventoryFilter = "All items" | Product["status"];
type OrderRequestDraft = { productName: string; quantity: string; supplierId: string; siteId: string };

function createOrderRequestDraft(products: Product[], supplierId: string, siteId: string): OrderRequestDraft {
	return { productName: products[0]?.name ?? "", quantity: "1", supplierId, siteId };
}

export default function InventoryCard() {
	const { products, orders, usageRecords, addProduct, updateProduct, removeProduct, updateStock, orderStock, recordUsage } = useInventory();
	const { suppliers, sites, requests, requestSourcingBatch, renameRequestedProduct } = useSuppliers();
	const { activeUser, canManageInventory } = useUsers();
	const notify = useNotify();
	const [query, setQuery] = useState("");
	const [activeFilter, setActiveFilter] = useState<InventoryFilter>("All items");
	const [openOptionsFor, setOpenOptionsFor] = useState<string | null>(null);
	const [dialogProduct, setDialogProduct] = useState<Product | null>(null);
	const [dialogMode, setDialogMode] = useState<"edit" | "order" | null>(null);
	const [productFormMode, setProductFormMode] = useState<"add" | "edit" | null>(null);
	const [editingProductName, setEditingProductName] = useState<string | null>(null);
	const [productDraft, setProductDraft] = useState({ name: "", category: "", stock: "0" });
	const [productError, setProductError] = useState("");
	const [draftUnits, setDraftUnits] = useState("");
	const [selectedSupplier, setSelectedSupplier] = useState("");
	const [usageDialogOpen, setUsageDialogOpen] = useState(false);
	const [orderRequestOpen, setOrderRequestOpen] = useState(false);
	const [orderRequestDrafts, setOrderRequestDrafts] = useState<OrderRequestDraft[]>([]);
	const [orderRequestError, setOrderRequestError] = useState("");
	const [usageItems, setUsageItems] = useState(() => [{ productName: products.find((product) => product.stock > 0)?.name ?? "", quantity: "1" }]);
	const [usageError, setUsageError] = useState("");
	const searchSites = useMemo(() => sites.filter((site) => site.type === "search"), [sites]);

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
	const usageSummaryByProduct = useMemo(() => {
		const summary = new Map<string, { units: number; records: number; lastUsedAt: string | null }>();
		usageRecords.forEach((record) => record.items.forEach((item) => {
			const current = summary.get(item.productName) ?? { units: 0, records: 0, lastUsedAt: null };
			current.units += item.quantity;
			current.records += 1;
			if (!current.lastUsedAt || record.recordedAt > current.lastUsedAt) current.lastUsedAt = record.recordedAt;
			summary.set(item.productName, current);
		}));
		return summary;
	}, [usageRecords]);

	useEffect(() => {
		if (!dialogProduct && !usageDialogOpen && !orderRequestOpen && !productFormMode) return;

		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setDialogProduct(null);
				setUsageDialogOpen(false);
				setOrderRequestOpen(false);
				setProductFormMode(null);
			}
		};
		window.addEventListener("keydown", closeOnEscape);
		return () => window.removeEventListener("keydown", closeOnEscape);
	}, [dialogProduct, usageDialogOpen, orderRequestOpen, productFormMode]);

	const openProductForm = (mode: "add" | "edit", product?: Product) => {
		setProductError("");
		setProductFormMode(mode);
		setEditingProductName(product?.name ?? null);
		setProductDraft({
			name: product?.name ?? "",
			category: product?.category ?? "",
			stock: String(product?.stock ?? 0),
		});
	};

	const saveProduct = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setProductError("");
		if (!canManageInventory) {
			setProductFormMode(null);
			notify("Only managers and admins can manage inventory products.");
			return;
		}
		const stock = Number(productDraft.stock);
		if (!Number.isSafeInteger(stock) || stock < 0) {
			setProductError("Starting stock must be a non-negative whole number.");
			return;
		}
		try {
			if (productFormMode === "add") {
				addProduct({ name: productDraft.name, category: productDraft.category, stock });
				notify(`${productDraft.name.trim()} added to inventory.`);
			} else if (productFormMode === "edit" && editingProductName) {
				updateProduct(editingProductName, { name: productDraft.name, category: productDraft.category });
				if (editingProductName !== productDraft.name.trim()) {
					renameRequestedProduct(editingProductName, productDraft.name.trim());
				}
				notify(`${productDraft.name.trim()} updated.`);
			}
			setProductFormMode(null);
			setEditingProductName(null);
		} catch (error) {
			setProductError(error instanceof Error ? error.message : "Could not save product.");
		}
	};

	const deleteProduct = (product: Product) => {
		if (!canManageInventory) {
			notify("Only managers and admins can remove inventory products.");
			return;
		}
		const hasOpenRequest = requests.some((request) => request.productName === product.name
			&& ["Pending review", "Sourcing approved", "Approved"].includes(request.status));
		if (hasOpenRequest) {
			notify("This product has an order request awaiting review and cannot be removed yet.");
			return;
		}
		if (!window.confirm(`Remove ${product.name} from inventory? Historical usage and received orders will be kept.`)) return;
		try {
			removeProduct(product.name);
			setOpenOptionsFor(null);
			notify(`${product.name} removed from inventory.`);
		} catch (error) {
			notify(error instanceof Error ? error.message : "Could not remove product.");
		}
	};

	const saveDialog = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!dialogProduct || !dialogMode || draftUnits.trim() === "") return;
		if (!canManageInventory) {
			setDialogProduct(null);
			setDialogMode(null);
			notify("Only managers and admins can edit inventory directly.");
			return;
		}

		const units = Number(draftUnits);
		if (!Number.isSafeInteger(units) || units < (dialogMode === "order" ? 1 : 0)) return;

		if (dialogMode === "edit") {
			updateStock(dialogProduct.name, units);
			notify(`${dialogProduct.name} quantity updated`);
		} else {
			if (!selectedSupplier) return;
			orderStock(dialogProduct.name, units, selectedSupplier);
			notify(`Order placed for ${units} ${units === 1 ? "unit" : "units"} of ${dialogProduct.name} from ${selectedSupplier}.`);
		}
		setDialogProduct(null);
		setDialogMode(null);
	};

	const openOrderRequest = () => {
		setOrderRequestDrafts([createOrderRequestDraft(products, suppliers[0]?.id ?? "", searchSites[0]?.id ?? "")]);
		setOrderRequestError("");
		setOrderRequestOpen(true);
	};

	const submitOrderRequest = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setOrderRequestError("");
		try {
			requestSourcingBatch(orderRequestDrafts.map((draft) => ({
				productName: draft.productName,
				quantity: Number(draft.quantity),
				supplierId: draft.supplierId,
				siteId: draft.siteId,
				requesterId: activeUser.id,
				requesterName: activeUser.name,
			})));
			notify(`${orderRequestDrafts.length} ${orderRequestDrafts.length === 1 ? "order request" : "order requests"} sent to managers and saved under the selected suppliers.`);
			setOrderRequestOpen(false);
		} catch (error) {
			setOrderRequestError(error instanceof Error ? error.message : "Could not send order request.");
		}
	};

	const submitUsage = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setUsageError("");
		try {
			recordUsage(usageItems.map((item) => ({
				productName: item.productName,
				quantity: Number(item.quantity),
			})), activeUser.name);
			notify(`Recorded usage for ${usageItems.length} ${usageItems.length === 1 ? "item" : "items"}.`);
			setUsageItems([{ productName: products.find((product) => product.stock > 0)?.name ?? "", quantity: "1" }]);
			setUsageDialogOpen(false);
		} catch (error) {
			setUsageError(error instanceof Error ? error.message : "Could not record inventory usage.");
		}
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
						{canManageInventory && <button className="usage-button" onClick={() => openProductForm("add")}><Icon name="plus" size={15}/> Add product</button>}
						<button className="usage-button" disabled={!products.some((product) => product.stock > 0)} onClick={() => { setUsageError(""); setUsageDialogOpen(true); }}><Icon name="plus" size={15}/> Record usage</button>
						<button className="usage-button" disabled={!products.length || !suppliers.length || !searchSites.length} onClick={openOrderRequest}><Icon name="plus" size={15}/> Request order</button>
						<button className="export-button" onClick={() => notify("Your inventory export is being prepared")}><Icon name="download" size={16}/> Export</button>
					</div>
				</div>
				<div className="table-scroll">
					<table>
						<thead><tr><th>PRODUCT</th><th>CATEGORY</th><th>STOCK</th><th>ON ORDER</th><th>USED</th><th>LAST USED</th><th>SHIPPING STATUS</th><th>STATUS</th>{canManageInventory && <th><span className="sr-only">Options</span></th>}</tr></thead>
						<tbody>{filteredProducts.map((product) => {
							const optionsId = `options-${product.name.replaceAll(" ", "-")}`;
							const usage = usageSummaryByProduct.get(product.name);
							return (
								<tr key={product.name}>
									<td><div className="product-cell"><div className={`product-thumb ${product.color}`}>{product.initials}</div><div><strong>{product.name}</strong></div></div></td>
									<td>{product.category}</td>
									<td><strong className="stock-number">{product.stock}</strong> <span className="units">units</span></td>
									<td><strong className="stock-number">{(orderSummaryByProduct.get(product.name)?.units ?? 0).toLocaleString()}</strong> <span className="units">units</span></td>
									<td>{usage ? <><strong className="stock-number">{usage.units.toLocaleString()}</strong> <span className="units">units · {usage.records} {usage.records === 1 ? "record" : "records"}</span></> : <span className="units">0 units</span>}</td>
									<td className="product-last-used">{usage?.lastUsedAt ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(usage.lastUsedAt)) : <span className="units">Never</span>}</td>
									<td><div className="product-shipping-status">{orderSummaryByProduct.get(product.name)?.statuses.length ? orderSummaryByProduct.get(product.name)?.statuses.map((status) => <span className={`order-status order-${status.toLowerCase()}`} key={status}>{status}</span>) : <span className="units">—</span>}</div></td>
									<td><span className={`status-badge ${product.status.toLowerCase().replaceAll(" ", "-")}`}><i/>{product.status}</span></td>
									{canManageInventory && <td>
										<div className="inventory-actions">
											<button className="row-more" aria-label={`Options for ${product.name}`} aria-expanded={openOptionsFor === product.name} aria-controls={optionsId} onClick={() => setOpenOptionsFor(openOptionsFor === product.name ? null : product.name)}><Icon name="more" size={18}/></button>
											{openOptionsFor === product.name && <div className="inventory-options" id={optionsId}>
												<button onClick={() => { openProductForm("edit", product); setOpenOptionsFor(null); }}>Edit product</button>
												<button onClick={() => { setDraftUnits(String(product.stock)); setDialogProduct(product); setDialogMode("edit"); setOpenOptionsFor(null); }}>Edit unit amount</button>
												<button onClick={() => { setDraftUnits(""); setSelectedSupplier(""); setDialogProduct(product); setDialogMode("order"); setOpenOptionsFor(null); }}>Order more stock</button>
												<button className="inventory-remove-option" onClick={() => deleteProduct(product)}>Remove product</button>
											</div>}
										</div>
									</td>}
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

			<section className="panel usage-history-panel">
				<div className="panel-heading"><div><h2>Recent inventory usage</h2><p>Recorded stock usage and who logged it</p></div><span className="usage-record-count">{usageRecords.length} {usageRecords.length === 1 ? "record" : "records"}</span></div>
				{usageRecords.length === 0 ? <p className="usage-empty">No inventory usage recorded yet.</p> : <div className="usage-history-list">
					{usageRecords.slice(0, 10).map((record) => (
						<article className="usage-history-row" key={record.id}>
							<div className="usage-history-meta"><strong>{record.recordedBy}</strong><span>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(record.recordedAt))}</span></div>
							<div className="usage-history-items">{record.items.map((item) => <span key={item.productName}>{item.productName} <strong>-{item.quantity}</strong></span>)}</div>
						</article>
					))}
				</div>}
			</section>

			{usageDialogOpen && <div className="edit-units-overlay"><section className="edit-units-dialog usage-dialog" role="dialog" aria-modal="true" aria-labelledby="usage-dialog-title">
				<h2 id="usage-dialog-title">Record inventory usage</h2>
				<p>List the products used. Stock will be deducted when you save.</p>
				<form onSubmit={submitUsage}>
					<div className="usage-form-items">{usageItems.map((item, index) => {
						const selectedProduct = products.find((product) => product.name === item.productName);
						return <div className="usage-form-row" key={index}>
							<label htmlFor={`usage-product-${index}`}>Product<select id={`usage-product-${index}`} required value={item.productName} onChange={(event) => setUsageItems((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, productName: event.target.value } : entry))}>
								<option value="" disabled>Select a product</option>
								{products.map((product) => <option key={product.name} value={product.name} disabled={product.stock === 0}>{product.name} · {product.stock} in stock</option>)}
							</select></label>
							<label htmlFor={`usage-quantity-${index}`}>Quantity used<input id={`usage-quantity-${index}`} type="number" min="1" max={selectedProduct?.stock ?? undefined} step="1" required value={item.quantity} onChange={(event) => setUsageItems((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, quantity: event.target.value } : entry))} /></label>
							{usageItems.length > 1 && <button className="usage-remove-row" type="button" aria-label={`Remove item ${index + 1}`} onClick={() => setUsageItems((current) => current.filter((_, entryIndex) => entryIndex !== index))}>Remove</button>}
						</div>;
					})}</div>
					<button className="usage-add-row" type="button" onClick={() => setUsageItems((current) => [...current, { productName: "", quantity: "1" }])}><Icon name="plus" size={14} /> Add another item</button>
					{usageError && <p className="form-error" role="alert">{usageError}</p>}
					<div className="edit-units-actions"><button type="button" className="cancel-edit" onClick={() => setUsageDialogOpen(false)}>Cancel</button><button type="submit" className="save-edit" disabled={!usageItems.length || !products.some((product) => product.stock > 0)}>Save usage</button></div>
				</form>
			</section></div>}

			{orderRequestOpen && <div className="edit-units-overlay"><section className="edit-units-dialog usage-dialog order-request-dialog" role="dialog" aria-modal="true" aria-labelledby="order-request-title">
				<h2 id="order-request-title">Request inventory order</h2>
				<p>Add one or more products. Each request will appear under its selected supplier for review.</p>
				<form onSubmit={submitOrderRequest}>
					<div className="order-request-items">{orderRequestDrafts.map((draft, index) => <div className="order-request-item" key={index}>
						<label htmlFor={`request-product-${index}`}>Product<select id={`request-product-${index}`} required value={draft.productName} onChange={(event) => setOrderRequestDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, productName: event.target.value } : item))}>
							{products.map((product) => <option key={product.name} value={product.name}>{product.name}</option>)}
						</select></label>
						<label htmlFor={`request-quantity-${index}`}>Quantity<input id={`request-quantity-${index}`} type="number" min="1" max={Number.MAX_SAFE_INTEGER} step="1" required value={draft.quantity} onChange={(event) => setOrderRequestDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: event.target.value } : item))} /></label>
						<label htmlFor={`request-supplier-${index}`}>Supplier<select id={`request-supplier-${index}`} required value={draft.supplierId} onChange={(event) => setOrderRequestDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, supplierId: event.target.value } : item))}>
							{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
						</select></label>
						<label htmlFor={`request-search-site-${index}`}>Search site<select id={`request-search-site-${index}`} required value={draft.siteId} onChange={(event) => setOrderRequestDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, siteId: event.target.value } : item))}>
							{searchSites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
						</select></label>
						{orderRequestDrafts.length > 1 && <button className="usage-remove-row order-request-remove" type="button" aria-label={`Remove order item ${index + 1}`} onClick={() => setOrderRequestDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>}
					</div>)}</div>
					<button className="usage-add-row" type="button" onClick={() => setOrderRequestDrafts((current) => [...current, createOrderRequestDraft(products, suppliers[0]?.id ?? "", searchSites[0]?.id ?? "")])}><Icon name="plus" size={14} /> Add another product</button>
					{orderRequestError && <p className="form-error" role="alert">{orderRequestError}</p>}
					<div className="edit-units-actions"><button type="button" className="cancel-edit" onClick={() => setOrderRequestOpen(false)}>Cancel</button><button type="submit" className="save-edit" disabled={!orderRequestDrafts.length || !products.length || !suppliers.length || !searchSites.length}>Submit {orderRequestDrafts.length || ""} {orderRequestDrafts.length === 1 ? "request" : "requests"}</button></div>
				</form>
			</section></div>}

			{productFormMode && <div className="edit-units-overlay"><section className="edit-units-dialog product-dialog" role="dialog" aria-modal="true" aria-labelledby="product-dialog-title">
				<h2 id="product-dialog-title">{productFormMode === "add" ? "Add inventory product" : "Edit product"}</h2>
				<p>{productFormMode === "add" ? "Add a product to your tracked inventory." : "Update the product name or category."}</p>
				<form onSubmit={saveProduct}>
					<label htmlFor="product-name">Product name</label>
					<input id="product-name" required maxLength={100} autoFocus value={productDraft.name} onChange={(event) => setProductDraft((current) => ({ ...current, name: event.target.value }))} />
					<label htmlFor="product-category">Category</label>
					<input id="product-category" required maxLength={80} value={productDraft.category} onChange={(event) => setProductDraft((current) => ({ ...current, category: event.target.value }))} />
					{productFormMode === "add" && <>
						<label htmlFor="product-stock">Starting units</label>
						<input id="product-stock" type="number" min="0" max={Number.MAX_SAFE_INTEGER} step="1" required value={productDraft.stock} onChange={(event) => setProductDraft((current) => ({ ...current, stock: event.target.value }))} />
						<small>Status is assigned automatically from the starting stock amount.</small>
					</>}
					{productError && <p className="form-error" role="alert">{productError}</p>}
					<div className="edit-units-actions"><button type="button" className="cancel-edit" onClick={() => setProductFormMode(null)}>Cancel</button><button type="submit" className="save-edit">{productFormMode === "add" ? "Add product" : "Save product"}</button></div>
				</form>
			</section></div>}

			{dialogProduct && dialogMode && <div className="edit-units-overlay"><section className="edit-units-dialog" role="dialog" aria-modal="true" aria-labelledby="inventory-dialog-title"><h2 id="inventory-dialog-title">{dialogMode === "edit" ? "Edit unit amount" : "Order more stock"}</h2><p>{dialogProduct.name}</p><form onSubmit={saveDialog}><label htmlFor="unit-amount">{dialogMode === "edit" ? "Units in stock" : "Amount to order"}</label><input id="unit-amount" type="number" min={dialogMode === "edit" ? 0 : 1} max={Number.MAX_SAFE_INTEGER} step="1" required autoFocus value={draftUnits} onChange={(event) => setDraftUnits(event.target.value)} />{dialogMode === "edit" ? <small>Status updates automatically: 0 is Out of stock, up to {LOW_STOCK_THRESHOLD} is Low stock.</small> : <><label htmlFor="stock-supplier">Supplier</label><select id="stock-supplier" required value={selectedSupplier} onChange={(event) => setSelectedSupplier(event.target.value)}><option value="" disabled>Select a supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.name}>{supplier.name}</option>)}</select><small>Ordered units will be added to available stock when received.</small></>}<div className="edit-units-actions"><button type="button" className="cancel-edit" onClick={() => { setDialogProduct(null); setDialogMode(null); }}>Cancel</button><button type="submit" className="save-edit">{dialogMode === "edit" ? "Save amount" : "Place order"}</button></div></form></section></div>}
		</>
	);
}
