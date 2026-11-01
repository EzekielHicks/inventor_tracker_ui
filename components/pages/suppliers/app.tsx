"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useInventory } from "@/components/providers/inventory-provider";
import { buildSiteUrl, useSuppliers, type Supplier } from "@/components/providers/supplier-provider";
import { useUsers } from "@/components/providers/user-provider";
import { useNotify } from "@/components/layout/workspace-shell";
import PageTemplate from "@/components/templates/page-template";
import Icon from "@/components/ui/icon";

type SupplierDraft = Omit<Supplier, "id">;

const emptySupplier: SupplierDraft = { name: "", email: "", phone: "", website: "" };

function isValidContactUrl(value: string) {
	if (!value) return true;
	try {
		const parsed = new URL(value);
		return parsed.protocol === "https:" && !parsed.username && !parsed.password;
	} catch {
		return false;
	}
}

function RequestStatus({ status }: { status: string }) {
	const displayStatus = ["Pending review", "Sourcing approved", "Approved"].includes(status) ? "Open request" : status;
	return <span className={`sourcing-status sourcing-${displayStatus.toLowerCase().replaceAll(" ", "-")}`}>{displayStatus}</span>;
}

export default function SuppliersApp() {
	const { orders, products, orderStock, renameOrderSupplier } = useInventory();
	const { suppliers, sites, requests, addSupplier, updateSupplier, deleteSupplier, requestSourcing, markRequestSubmitted } = useSuppliers();
	const { activeUser, canManageSuppliers, canReviewOrders } = useUsers();
	const notify = useNotify();
	const [supplierDraft, setSupplierDraft] = useState<SupplierDraft>(emptySupplier);
	const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
	const [supplierError, setSupplierError] = useState("");
	const [requestErrors, setRequestErrors] = useState<Record<string, string>>({});
	const [deletingSupplierId, setDeletingSupplierId] = useState<string | null>(null);
	const [orderDrafts, setOrderDrafts] = useState<Record<string, { productName: string; quantity: string; siteId: string }>>({});
	const [newRequestOpen, setNewRequestOpen] = useState(false);
	const [newRequestDraft, setNewRequestDraft] = useState({ productName: "", quantity: "1", supplierId: "", siteId: "" });
	const [newRequestError, setNewRequestError] = useState("");

	const openRequests = useMemo(() => requests.filter((request) => ["Pending review", "Sourcing approved", "Approved"].includes(request.status)), [requests]);
	const visibleRequests = canReviewOrders ? requests : requests.filter((request) => request.requesterId === activeUser.id);
	const searchSites = sites.filter((site) => site.type === "search");
	const submitSupplier = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setSupplierError("");
		if (!supplierDraft.name.trim() || !isValidContactUrl(supplierDraft.website)) {
			setSupplierError("Enter a supplier name and a valid HTTPS website.");
			return;
		}
		try {
			if (editingSupplierId) {
				const oldName = suppliers.find((supplier) => supplier.id === editingSupplierId)?.name;
				updateSupplier(editingSupplierId, supplierDraft);
				if (oldName && oldName !== supplierDraft.name.trim()) renameOrderSupplier(oldName, supplierDraft.name.trim());
			} else addSupplier(supplierDraft);
			setSupplierDraft(emptySupplier);
			setEditingSupplierId(null);
			notify(editingSupplierId ? "Supplier updated." : "Supplier added.");
		} catch (error) {
			setSupplierError(error instanceof Error ? error.message : "Could not save supplier.");
		}
	};
	const submitRequest = (event: FormEvent<HTMLFormElement>, supplier: Supplier) => {
		event.preventDefault();
		const draft = orderDrafts[supplier.id] ?? {
			productName: products[0]?.name ?? "",
			quantity: "1",
			siteId: searchSites[0]?.id ?? "",
		};
		setRequestErrors((current) => ({ ...current, [supplier.id]: "" }));
		const selectedProduct = products.find((product) => product.name === draft.productName);
		if (!selectedProduct) {
			setRequestErrors((current) => ({ ...current, [supplier.id]: "Choose a product from the current inventory." }));
			return;
		}
		try {
			requestSourcing({
				supplierId: supplier.id,
				productName: selectedProduct.name,
				quantity: Number(draft.quantity),
				siteId: draft.siteId,
				requesterId: activeUser.id,
				requesterName: activeUser.name,
			});
			setOrderDrafts((current) => ({ ...current, [supplier.id]: { ...draft, quantity: "1" } }));
			notify(`Sourcing request for ${draft.quantity} ${Number(draft.quantity) === 1 ? "unit" : "units"} of ${selectedProduct.name} added.`);
		} catch (error) {
			setRequestErrors((current) => ({ ...current, [supplier.id]: error instanceof Error ? error.message : "Could not send request." }));
		}
	};
	const openNewRequest = () => {
		setNewRequestDraft({
			productName: products[0]?.name ?? "",
			quantity: "1",
			supplierId: suppliers[0]?.id ?? "",
			siteId: searchSites[0]?.id ?? "",
		});
		setNewRequestError("");
		setNewRequestOpen(true);
	};
	const submitNewRequest = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setNewRequestError("");
		const product = products.find((item) => item.name === newRequestDraft.productName);
		if (!product) {
			setNewRequestError("Choose a product from the current inventory.");
			return;
		}
		try {
			requestSourcing({
				productName: product.name,
				quantity: Number(newRequestDraft.quantity),
				supplierId: newRequestDraft.supplierId,
				siteId: newRequestDraft.siteId,
				requesterId: activeUser.id,
				requesterName: activeUser.name,
			});
			const supplier = suppliers.find((item) => item.id === newRequestDraft.supplierId);
			notify(`Order request for ${newRequestDraft.quantity} ${Number(newRequestDraft.quantity) === 1 ? "unit" : "units"} of ${product.name} added${supplier ? ` to ${supplier.name}` : ""}.`);
			setNewRequestOpen(false);
		} catch (error) {
			setNewRequestError(error instanceof Error ? error.message : "Could not create order request.");
		}
	};
	const recordOrderPlaced = (requestId: string) => {
		const request = requests.find((item) => item.id === requestId && ["Pending review", "Sourcing approved", "Approved"].includes(item.status));
		const supplier = request?.supplierId ? suppliers.find((item) => item.id === request.supplierId) : undefined;
		if (!request || !supplier) {
			notify("The open supplier order request could not be found.");
			return;
		}
		try {
			markRequestSubmitted(request.id);
			orderStock(request.productName, request.quantity, supplier.name);
			notify(`Recorded order for ${request.quantity} ${request.quantity === 1 ? "unit" : "units"} of ${request.productName} from ${supplier.name}.`);
		} catch (error) {
			notify(error instanceof Error ? error.message : "Could not record the order.");
		}
	};
	const siteForRequest = (requestSiteId: string) => sites.find((site) => site.id === requestSiteId);

	if (!canManageSuppliers) {
		return (
			<PageTemplate
				eyebrow="WORKSPACE / SUPPLIERS"
				title="Supplier access restricted"
				description="Supplier management and sourcing history are available to managers and admins."
			>
				<section className="panel supplier-access-restricted"><strong>Use Inventory to submit an order request.</strong><p>Managers and admins can manage supplier details and view sourcing history here.</p></section>
			</PageTemplate>
		);
	}

	return (
		<PageTemplate
			eyebrow="WORKSPACE / SUPPLIERS"
			title="Suppliers"
			description="Manage supplier contacts, search requested products, and record orders placed."
			action={canManageSuppliers ? <span className="manager-role-label">Manager tools enabled</span> : undefined}
		>
			{canReviewOrders && <section className={`panel approval-notice${openRequests.length ? " approval-notice-pending" : ""}`} aria-live="polite">
				<span className="approval-notice-icon"><Icon name="bell" size={18} /></span>
				<div><strong>{openRequests.length === 1 ? "1 open order request" : openRequests.length ? `${openRequests.length} open order requests` : "No open order requests"}</strong><p>Search requested products, then record the order after checkout.</p></div>
				{openRequests.length > 0 && <span className="approval-count">{openRequests.length}</span>}
				<button className="primary-button approval-new-request" type="button" disabled={!products.length || !suppliers.length} onClick={openNewRequest}><Icon name="plus" size={14} /> New order request</button>
			</section>}

			<section className="panel supplier-management">
				<div className="panel-heading"><div><h2>Supplier directory</h2><p>Contact details and order history</p></div></div>
				{canManageSuppliers && <form className="supplier-form" onSubmit={submitSupplier}>
					<div className="supplier-form-heading"><strong>{editingSupplierId ? "Edit supplier" : "Add a supplier"}</strong><span>Contact links are optional.</span></div>
					<div className="supplier-form-grid">
						<label>Supplier name<input required maxLength={80} value={supplierDraft.name} onChange={(event) => setSupplierDraft({ ...supplierDraft, name: event.target.value })} placeholder="Company name" /></label>
						<label>Email<input type="email" maxLength={120} value={supplierDraft.email} onChange={(event) => setSupplierDraft({ ...supplierDraft, email: event.target.value })} placeholder="orders@example.com" /></label>
						<label>Phone<input type="tel" maxLength={32} value={supplierDraft.phone} onChange={(event) => setSupplierDraft({ ...supplierDraft, phone: event.target.value })} placeholder="+1 555 0100" /></label>
						<label>Website<input type="url" value={supplierDraft.website} onChange={(event) => setSupplierDraft({ ...supplierDraft, website: event.target.value })} placeholder="https://supplier.example" /></label>
					</div>
					{supplierError && <p className="form-error" role="alert">{supplierError}</p>}
					<div className="supplier-form-actions">{editingSupplierId && <button type="button" className="text-button" onClick={() => { setEditingSupplierId(null); setSupplierDraft(emptySupplier); setSupplierError(""); }}>Cancel edit</button>}<button type="submit" className="primary-button">{editingSupplierId ? "Save supplier" : "Add supplier"}</button></div>
				</form>}
				<div className="supplier-grid">
					{suppliers.map((supplier) => {
						const supplierOrders = orders.filter((order) => order.supplier === supplier.name);
						const outstandingUnits = supplierOrders.filter((order) => order.status !== "Received").reduce((total, order) => total + order.quantity, 0);
						const receivedUnits = supplierOrders.filter((order) => order.status === "Received").reduce((total, order) => total + order.quantity, 0);
						const hasOrders = supplierOrders.length > 0;
						const hasRequests = requests.some((request) => request.supplierId === supplier.id);
						const draft = orderDrafts[supplier.id] ?? {
							productName: products[0]?.name ?? "",
							quantity: "1",
							siteId: searchSites[0]?.id ?? "",
						};
						return (
							<article className="panel supplier-card" key={supplier.id}>
								<div className="supplier-heading"><span className="supplier-avatar">{supplier.name.slice(0, 1).toUpperCase()}</span><div><h2>{supplier.name}</h2><p>{supplier.email || supplier.phone || "Inventory supplier"}</p></div></div>
								<div className="supplier-contact-links">
									{supplier.email && <a href={`mailto:${supplier.email}`}>Email supplier</a>}
									{supplier.phone && <a href={`tel:${supplier.phone}`}>Call supplier</a>}
									{isValidContactUrl(supplier.website) && supplier.website && <a href={supplier.website} target="_blank" rel="noreferrer">Visit website</a>}
								</div>
								<div className="supplier-metrics">
									<div><strong>{supplierOrders.length}</strong><span>orders</span></div>
									<div><strong>{outstandingUnits.toLocaleString()}</strong><span>units on order</span></div>
									<div><strong>{receivedUnits.toLocaleString()}</strong><span>units received</span></div>
								</div>
								<div className="supplier-last-order">{supplierOrders.length ? `Latest order ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(supplierOrders[supplierOrders.length - 1].orderedAt))}` : "No orders placed yet"}</div>
								{supplierOrders.length > 0 && <div className="supplier-order-history">
									<strong>Recent orders</strong>
									{supplierOrders.slice(-3).reverse().map((order) => <div className="supplier-order-history-row" key={order.id}><span>{order.productName} · {order.quantity.toLocaleString()} units</span><RequestStatus status={order.status} /></div>)}
								</div>}
								<div className="supplier-workflow">
									<div className="supplier-workflow-heading"><strong>Sourcing requests</strong><span>Search products and record orders once placed.</span></div>
									<form className="supplier-order-request-form" onSubmit={(event) => submitRequest(event, supplier)}>
										<label>Item<select required value={draft.productName} onChange={(event) => setOrderDrafts((current) => ({ ...current, [supplier.id]: { ...draft, productName: event.target.value } }))}>{products.map((product) => <option key={product.name} value={product.name}>{product.name}</option>)}</select></label>
										<label>Order quantity<input type="number" min="1" step="1" required value={draft.quantity} onChange={(event) => setOrderDrafts((current) => ({ ...current, [supplier.id]: { ...draft, quantity: event.target.value } }))} /></label>
										<label>Search site (optional)<select value={draft.siteId} onChange={(event) => setOrderDrafts((current) => ({ ...current, [supplier.id]: { ...draft, siteId: event.target.value } }))}><option value="">No web search</option>{searchSites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
										<button className="primary-button" type="submit" disabled={!products.length}>Submit request</button>
									</form>
									{requestErrors[supplier.id] && <p className="form-error" role="alert">{requestErrors[supplier.id]}</p>}
									<p className="supplier-no-requests">Requests and sourcing history appear below.</p>
								</div>
								{canManageSuppliers && <div className="supplier-card-actions">
									<button className="text-button" onClick={() => { setEditingSupplierId(supplier.id); setSupplierDraft({ name: supplier.name, email: supplier.email, phone: supplier.phone, website: supplier.website }); setSupplierError(""); }}>Edit</button>
									{deletingSupplierId === supplier.id ? <><span className="delete-confirm-label">{hasOrders ? "Has order history" : hasRequests ? "Has sourcing requests" : "Delete supplier?"}</span><button className="delete-supplier-button" disabled={hasOrders || hasRequests} onClick={() => { try { deleteSupplier(supplier.id); setDeletingSupplierId(null); notify("Supplier deleted."); } catch (error) { notify(error instanceof Error ? error.message : "Could not delete supplier."); } }}>Confirm</button><button className="text-button" onClick={() => setDeletingSupplierId(null)}>Cancel</button></> : <button className="delete-supplier-button" onClick={() => setDeletingSupplierId(supplier.id)}>Delete</button>}
								</div>}
							</article>
						);
					})}
				</div>
			</section>

			<section className="panel sourcing-history-panel">
				<div className="panel-heading"><div><h2>Sourcing requests and history</h2><p>Search open requests and track submitted sourcing activity.</p></div></div>
				{visibleRequests.length === 0 ? <p className="sourcing-empty">No sourcing requests yet.</p> : (
					<div className="sourcing-request-list">
						{visibleRequests.map((request) => {
							const site = siteForRequest(request.siteId);
							let searchUrl = "";
							if (site?.type === "search" && site.url) {
								try { searchUrl = buildSiteUrl(site, request.productName); } catch { searchUrl = ""; }
							}
							const supplierName = suppliers.find((supplier) => supplier.id === request.supplierId)?.name ?? request.supplierName ?? "Direct purchase";
							const isOpen = ["Pending review", "Sourcing approved", "Approved"].includes(request.status);
							return <article className="sourcing-request-row" key={request.id}>
								<div className="sourcing-request-details">
									<strong>{request.productName} <span>× {request.quantity.toLocaleString()} {request.quantity === 1 ? "unit" : "units"}</span></strong>
									<span>{supplierName} · Requested by {request.requesterName} · {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(request.createdAt))}</span>
								</div>
								<RequestStatus status={request.status} />
								<div className="sourcing-history-actions">
									{searchUrl ? <a className="search-site-link" href={searchUrl} target="_blank" rel="noreferrer">Search {site?.name}</a> : <span className="sourcing-no-search">No web search configured</span>}
									{canReviewOrders && isOpen && request.supplierId && <button className="primary-button" onClick={() => recordOrderPlaced(request.id)}>Record order placed</button>}
									{canReviewOrders && isOpen && !request.supplierId && <button className="secondary-button" onClick={() => { try { markRequestSubmitted(request.id); notify("Request marked submitted."); } catch (error) { notify(error instanceof Error ? error.message : "Could not update request."); } }}>Mark submitted</button>}
								</div>
							</article>;
						})}
					</div>
				)}
			</section>

			{newRequestOpen && <div className="edit-units-overlay"><section className="edit-units-dialog new-supplier-request-dialog" role="dialog" aria-modal="true" aria-labelledby="new-supplier-request-title">
				<h2 id="new-supplier-request-title">Create order request</h2>
				<p>Choose the supplier and optionally select a configured web search.</p>
				<form onSubmit={submitNewRequest}>
					<label htmlFor="new-request-product">Product</label>
					<select id="new-request-product" required value={newRequestDraft.productName} onChange={(event) => setNewRequestDraft((current) => ({ ...current, productName: event.target.value }))}>
						{products.map((product) => <option key={product.name} value={product.name}>{product.name}</option>)}
					</select>
					<label htmlFor="new-request-quantity">Quantity</label>
					<input id="new-request-quantity" type="number" min="1" step="1" required value={newRequestDraft.quantity} onChange={(event) => setNewRequestDraft((current) => ({ ...current, quantity: event.target.value }))} />
					<label htmlFor="new-request-supplier">Supplier</label>
					<select id="new-request-supplier" required value={newRequestDraft.supplierId} onChange={(event) => setNewRequestDraft((current) => ({ ...current, supplierId: event.target.value }))}>
						{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
					</select>
					<label htmlFor="new-request-site">Search site (optional)</label>
					<select id="new-request-site" value={newRequestDraft.siteId} onChange={(event) => setNewRequestDraft((current) => ({ ...current, siteId: event.target.value }))}>
						<option value="">No web search</option>
						{searchSites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
					</select>
					{newRequestError && <p className="form-error" role="alert">{newRequestError}</p>}
					<div className="edit-units-actions"><button type="button" className="cancel-edit" onClick={() => setNewRequestOpen(false)}>Cancel</button><button type="submit" className="save-edit" disabled={!products.length || !suppliers.length}>Create request</button></div>
				</form>
			</section></div>}
		</PageTemplate>
	);
}
