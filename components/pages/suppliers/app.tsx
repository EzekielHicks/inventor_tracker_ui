"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useInventory } from "@/components/providers/inventory-provider";
import { buildSiteUrl, useSuppliers, type SourcingSite, type Supplier } from "@/components/providers/supplier-provider";
import { useUsers } from "@/components/providers/user-provider";
import { useNotify } from "@/components/layout/workspace-shell";
import PageTemplate from "@/components/templates/page-template";
import Icon from "@/components/ui/icon";

type SupplierDraft = Omit<Supplier, "id">;
type SiteDraft = Omit<SourcingSite, "id">;

const emptySupplier: SupplierDraft = { name: "", email: "", phone: "", website: "" };
const emptySite: SiteDraft = { name: "", type: "search", url: "" };

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
	return <span className={`sourcing-status sourcing-${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span>;
}

export default function SuppliersApp() {
	const { orders, products, orderStock, renameOrderSupplier } = useInventory();
	const { suppliers, sites, requests, addSupplier, updateSupplier, deleteSupplier, addSite, updateSite, deleteSite, requestSourcing, reviewRequest, markRequestSubmitted } = useSuppliers();
	const { activeUser, canManageSuppliers, canReviewOrders } = useUsers();
	const notify = useNotify();
	const [supplierDraft, setSupplierDraft] = useState<SupplierDraft>(emptySupplier);
	const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
	const [siteDraft, setSiteDraft] = useState<SiteDraft>(emptySite);
	const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
	const [supplierError, setSupplierError] = useState("");
	const [siteError, setSiteError] = useState("");
	const [requestErrors, setRequestErrors] = useState<Record<string, string>>({});
	const [deletingSupplierId, setDeletingSupplierId] = useState<string | null>(null);
	const [orderDrafts, setOrderDrafts] = useState<Record<string, { productName: string; quantity: string; siteId: string }>>({});

	const pendingRequests = useMemo(() => requests.filter((request) => request.status === "Pending review" || request.status === "Sourcing approved"), [requests]);
	const visibleRequests = canReviewOrders ? requests : requests.filter((request) => request.requesterId === activeUser.id);
	const legacyRequests = visibleRequests.filter((request) => !request.supplierId);
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
	const submitSite = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setSiteError("");
		try {
			if (editingSiteId) updateSite(editingSiteId, siteDraft);
			else addSite(siteDraft);
			setSiteDraft(emptySite);
			setEditingSiteId(null);
			notify(editingSiteId ? "Sourcing site updated." : "Sourcing site added.");
		} catch (error) {
			setSiteError(error instanceof Error ? error.message : "Could not save sourcing site.");
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
			notify(`Order request for ${draft.quantity} ${Number(draft.quantity) === 1 ? "unit" : "units"} of ${selectedProduct.name} sent to managers.`);
		} catch (error) {
			setRequestErrors((current) => ({ ...current, [supplier.id]: error instanceof Error ? error.message : "Could not send request." }));
		}
	};
	const approveRequest = (id: string, status: "Sourcing approved" | "Approved" | "Rejected") => {
		try {
			reviewRequest(id, status, activeUser.name);
			notify(status === "Sourcing approved" ? "Sourcing review approved. Order approval is now required." : status === "Approved" ? "Order approved. A manager can prepare it for submission." : "Request declined.");
		} catch (error) {
			notify(error instanceof Error ? error.message : "Could not update the request.");
		}
	};
	const submitApprovedOrder = (requestId: string) => {
		const request = requests.find((item) => item.id === requestId && item.status === "Approved");
		const supplier = request?.supplierId ? suppliers.find((item) => item.id === request.supplierId) : undefined;
		if (!request || !supplier) {
			notify("The approved supplier order could not be found.");
			return;
		}
		try {
			markRequestSubmitted(request.id);
			orderStock(request.productName, request.quantity, supplier.name);
			notify(`Submitted order for ${request.quantity} ${request.quantity === 1 ? "unit" : "units"} of ${request.productName} to ${supplier.name}.`);
		} catch (error) {
			notify(error instanceof Error ? error.message : "Could not submit the approved order.");
		}
	};
	const siteForRequest = (requestSiteId: string) => sites.find((site) => site.id === requestSiteId);

	return (
		<PageTemplate
			eyebrow="WORKSPACE / SUPPLIERS"
			title="Suppliers"
			description="Manage supplier contacts, prepare sourcing requests, and review purchases before checkout."
			action={canManageSuppliers ? <span className="manager-role-label">Manager tools enabled</span> : undefined}
		>
			{canReviewOrders && <section className={`panel approval-notice${pendingRequests.length ? " approval-notice-pending" : ""}`} aria-live="polite">
				<span className="approval-notice-icon"><Icon name="bell" size={18} /></span>
				<div><strong>{pendingRequests.length === 1 ? "1 order request needs review" : pendingRequests.length ? `${pendingRequests.length} order requests need review` : "No order requests need review"}</strong><p>Only managers can approve or decline sourcing requests.</p></div>
				{pendingRequests.length > 0 && <span className="approval-count">{pendingRequests.length}</span>}
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
						const supplierRequests = visibleRequests.filter((request) => request.supplierId === supplier.id);
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
									<div className="supplier-workflow-heading"><strong>Sourcing &amp; order review</strong><span>Requested units become the order quantity.</span></div>
									<form className="supplier-order-request-form" onSubmit={(event) => submitRequest(event, supplier)}>
										<label>Item<select required value={draft.productName} onChange={(event) => setOrderDrafts((current) => ({ ...current, [supplier.id]: { ...draft, productName: event.target.value } }))}>{products.map((product) => <option key={product.name} value={product.name}>{product.name}</option>)}</select></label>
										<label>Order quantity<input type="number" min="1" step="1" required value={draft.quantity} onChange={(event) => setOrderDrafts((current) => ({ ...current, [supplier.id]: { ...draft, quantity: event.target.value } }))} /></label>
										<label>Search site<select required value={draft.siteId} onChange={(event) => setOrderDrafts((current) => ({ ...current, [supplier.id]: { ...draft, siteId: event.target.value } }))}>{searchSites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
										<button className="primary-button" type="submit" disabled={!products.length || !searchSites.length}>Submit request</button>
									</form>
									{requestErrors[supplier.id] && <p className="form-error" role="alert">{requestErrors[supplier.id]}</p>}
									<div className="supplier-card-requests">
										{supplierRequests.length === 0 ? <p className="supplier-no-requests">No sourcing or order reviews yet.</p> : supplierRequests.map((request) => {
											const site = siteForRequest(request.siteId);
											let searchUrl = "";
											if (site?.type === "search") {
												try { searchUrl = buildSiteUrl(site, request.productName); } catch { searchUrl = ""; }
											}
											return <article className="supplier-request-card" key={request.id}>
												<div className="supplier-request-summary"><strong>{request.productName} · {request.quantity.toLocaleString()} {request.quantity === 1 ? "unit" : "units"}</strong><RequestStatus status={request.status} /></div>
												<div className="supplier-request-meta">Requested by {request.requesterName} · {request.siteName} · {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(request.createdAt))}</div>
												{request.reviewedBy && <small className="supplier-request-reviewer">Reviewed by {request.reviewedBy}</small>}
												{canReviewOrders && request.status === "Pending review" && <div className="supplier-request-actions"><button className="secondary-button" onClick={() => approveRequest(request.id, "Rejected")}>Decline sourcing</button><button className="primary-button" onClick={() => approveRequest(request.id, "Sourcing approved")}>Approve sourcing</button></div>}
												{canReviewOrders && request.status === "Sourcing approved" && <div className="supplier-request-actions"><button className="secondary-button" onClick={() => approveRequest(request.id, "Rejected")}>Decline order</button><button className="primary-button" onClick={() => approveRequest(request.id, "Approved")}>Approve order</button></div>}
												{canReviewOrders && request.status === "Approved" && <div className="supplier-request-actions">{searchUrl ? <a className="search-site-link" href={searchUrl} target="_blank" rel="noreferrer">Open {request.siteName} search</a> : <span className="form-error">Search template unavailable.</span>}<button className="primary-button" onClick={() => submitApprovedOrder(request.id)}>Record order placed</button></div>}
											</article>;
										})}
									</div>
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

			{legacyRequests.length > 0 && <section className="panel sourcing-inbox-panel">
				<div className="panel-heading"><div><h2>Unassigned legacy requests</h2><p>Older requests are not linked to a supplier card.</p></div></div>
				<div className="sourcing-request-list">
					{legacyRequests.map((request) => {
						const site = siteForRequest(request.siteId);
						let searchUrl = "";
						if (site?.type === "search") {
							try { searchUrl = buildSiteUrl(site, request.productName); } catch { searchUrl = ""; }
						}
						return <article className="sourcing-request-row" key={request.id}>
							<div className="sourcing-request-details"><strong>{request.productName} <span>× {request.quantity}</span></strong><span>Requested by {request.requesterName} · {request.siteName} · {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(request.createdAt))}</span>{request.reviewedBy && <small>Reviewed by {request.reviewedBy}</small>}</div>
							<RequestStatus status={request.status} />
							{canReviewOrders && request.status === "Pending review" && <div className="sourcing-review-actions"><button className="secondary-button" onClick={() => approveRequest(request.id, "Rejected")}>Decline</button><button className="primary-button" onClick={() => approveRequest(request.id, "Approved")}>Approve search</button></div>}
							{canReviewOrders && request.status === "Approved" && <div className="sourcing-review-actions">{searchUrl ? <a className="search-site-link" href={searchUrl} target="_blank" rel="noreferrer">Open {request.siteName} search</a> : <span className="form-error">Search template unavailable.</span>}<button className="secondary-button" onClick={() => { try { markRequestSubmitted(request.id); notify("Request marked submitted after supplier checkout."); } catch (error) { notify(error instanceof Error ? error.message : "Could not update request."); } }}>Mark submitted</button></div>}
						</article>;
					})}
				</div>
			</section>}

			{canManageSuppliers && <section className="panel sourcing-sites-panel">
				<div className="panel-heading"><div><h2>Site and API templates</h2><p>Manager-configured destinations; API credentials and live integrations are not stored in this browser.</p></div></div>
				<form className="site-template-form" onSubmit={submitSite}>
					<label>Template name<input required maxLength={60} value={siteDraft.name} onChange={(event) => setSiteDraft({ ...siteDraft, name: event.target.value })} placeholder="e.g. Supplier catalog" /></label>
					<label>Template type<select value={siteDraft.type} onChange={(event) => setSiteDraft({ ...siteDraft, type: event.target.value as SiteDraft["type"], url: "" })}><option value="search">Web search</option><option value="api">API endpoint template</option></select></label>
					<label>{siteDraft.type === "search" ? "HTTPS search URL (include {query})" : "HTTPS API base endpoint"}<input required type="text" value={siteDraft.url} onChange={(event) => setSiteDraft({ ...siteDraft, url: event.target.value })} placeholder={siteDraft.type === "search" ? "https://shop.example/search?q={query}" : "https://api.example.com/v1"} /></label>
					<div className="site-template-actions">{editingSiteId && <button className="secondary-button" type="button" onClick={() => { setEditingSiteId(null); setSiteDraft(emptySite); setSiteError(""); }}>Cancel edit</button>}<button className="primary-button" type="submit">{editingSiteId ? "Save template" : "Add template"}</button></div>
				</form>
				{siteError && <p className="form-error" role="alert">{siteError}</p>}
				<div className="site-template-list">{sites.map((site) => <div className="site-template-row" key={site.id}><div><strong>{site.name}</strong><span>{site.type === "search" ? "Web search" : "API template"} · {site.url}</span></div><div><button className="text-button" onClick={() => { setEditingSiteId(site.id); setSiteDraft({ name: site.name, type: site.type, url: site.url }); setSiteError(""); }}>Edit</button><button className="delete-supplier-button" disabled={requests.some((request) => request.siteId === site.id)} title={requests.some((request) => request.siteId === site.id) ? "Keep this template because requests reference it." : "Delete site template"} onClick={() => { try { deleteSite(site.id); notify("Site template deleted."); } catch (error) { notify(error instanceof Error ? error.message : "Could not delete template."); } }}>Delete</button></div></div>)}</div>
				<p className="sourcing-safety-note">Templates only generate HTTPS search links. API entries are configuration placeholders—connecting an API requires a trusted server integration and credentials stored outside the browser.</p>
			</section>}
		</PageTemplate>
	);
}
