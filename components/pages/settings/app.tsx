"use client";

import { useState, type FormEvent } from "react";
import { useInventory, type InventorySettings } from "@/components/providers/inventory-provider";
import { useSuppliers, type SourcingSite } from "@/components/providers/supplier-provider";
import { useUsers } from "@/components/providers/user-provider";
import { useNotify } from "@/components/layout/workspace-shell";
import PageTemplate from "@/components/templates/page-template";

type SiteDraft = Omit<SourcingSite, "id">;

const emptySite: SiteDraft = { name: "", type: "search", url: "" };

function InventoryThresholdSettings({ settings }: { settings: InventorySettings }) {
	const { updateInventorySettings } = useInventory();
	const notify = useNotify();
	const [draft, setDraft] = useState(settings);
	const [error, setError] = useState("");

	const saveSettings = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError("");
		if (!Number.isSafeInteger(draft.defaultLowStockThreshold) || draft.defaultLowStockThreshold < 1) {
			setError("Enter a positive whole number for the low-stock threshold.");
			return;
		}
		try {
			updateInventorySettings(draft);
			notify("Inventory settings saved.");
		} catch (saveError) {
			setError(saveError instanceof Error ? saveError.message : "Could not save inventory settings.");
		}
	};

	return (
		<div className="settings-grid">
			<section className="panel inventory-settings-panel">
				<div className="panel-heading">
					<div><h2>Inventory status thresholds</h2><p>Set when products are marked low stock.</p></div>
				</div>
				<form className="inventory-settings-form" onSubmit={saveSettings}>
					<label className="settings-toggle">
						<input
							type="checkbox"
							checked={draft.lowStockThresholdEnabled}
							onChange={(event) => setDraft((current) => ({ ...current, lowStockThresholdEnabled: event.target.checked }))}
						/>
						<span><strong>Enable low-stock thresholds</strong><small>When disabled, positive stock is “In stock”; zero remains “Out of stock.”</small></span>
					</label>
					<label className="settings-threshold-field" htmlFor="default-low-stock-threshold">
						Default low-stock threshold
						<span><input
							id="default-low-stock-threshold"
							type="number"
							min="1"
							max={Number.MAX_SAFE_INTEGER}
							step="1"
							required={draft.lowStockThresholdEnabled}
							disabled={!draft.lowStockThresholdEnabled}
							value={draft.defaultLowStockThreshold}
							onChange={(event) => setDraft((current) => ({ ...current, defaultLowStockThreshold: Number(event.target.value) }))}
						/> units</span>
						<small>Products at or below this amount are marked “Low stock,” unless they have a custom threshold.</small>
					</label>
					{error && <p className="form-error" role="alert">{error}</p>}
					<div className="settings-actions">
						<button className="secondary-button" type="button" onClick={() => setDraft({ lowStockThresholdEnabled: true, defaultLowStockThreshold: 10 })}>Use recommended</button>
						<button className="primary-button" type="submit">Save settings</button>
					</div>
				</form>
			</section>
			<aside className="panel settings-recommendation">
				<span className="settings-recommendation-label">RECOMMENDED</span>
				<h2>Start with 10 units</h2>
				<p>For most stockrooms, marking products low at 10 units gives managers time to reorder before items run out.</p>
				<ul>
					<li>0 units: Out of stock</li>
					<li>1–10 units: Low stock</li>
					<li>More than 10 units: In stock</li>
				</ul>
				<p className="settings-recommendation-note">The default threshold can be overridden on individual products when adding or editing them.</p>
			</aside>
		</div>
	);
}

function WebSourcingSettings() {
	const { sites, requests, addSite, updateSite, deleteSite } = useSuppliers();
	const notify = useNotify();
	const [draft, setDraft] = useState<SiteDraft>(emptySite);
	const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
	const [error, setError] = useState("");

	const saveSite = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError("");
		try {
			if (editingSiteId) updateSite(editingSiteId, draft);
			else addSite(draft);
			setDraft(emptySite);
			setEditingSiteId(null);
			notify(editingSiteId ? "Web sourcing template updated." : "Web sourcing template added.");
		} catch (saveError) {
			setError(saveError instanceof Error ? saveError.message : "Could not save web sourcing template.");
		}
	};

	return (
		<section className="panel web-sourcing-settings">
			<div className="panel-heading">
				<div><h2>Web sourcing</h2><p>Configure optional web search links and API connection placeholders.</p></div>
			</div>
			<form className="site-template-form" onSubmit={saveSite}>
				<label>Template name<input required maxLength={60} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Supplier catalog" /></label>
				<label>Template type<select value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as SiteDraft["type"], url: "" }))}><option value="search">Web search</option><option value="api">API connection</option></select></label>
				<label>{draft.type === "search" ? "HTTPS search URL (optional; include {query})" : "HTTPS API endpoint (optional)"}<input type="text" value={draft.url} onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))} placeholder={draft.type === "search" ? "https://shop.example/search?q={query}" : "https://api.example.com/v1"} /></label>
				<div className="site-template-actions">
					{editingSiteId && <button className="secondary-button" type="button" onClick={() => { setEditingSiteId(null); setDraft(emptySite); setError(""); }}>Cancel edit</button>}
					<button className="primary-button" type="submit">{editingSiteId ? "Save template" : "Add template"}</button>
				</div>
			</form>
			{error && <p className="form-error" role="alert">{error}</p>}
			{sites.length === 0 ? <p className="site-template-empty">No web sourcing templates. Order requests can still be submitted without a search link.</p> : (
				<div className="site-template-list">{sites.map((site) => {
					const isReferenced = requests.some((request) => request.siteId === site.id);
					return <div className="site-template-row" key={site.id}>
						<div><strong>{site.name}</strong><span>{site.type === "search" ? "Web search" : "API connection"} · {site.url || "Not connected"}</span></div>
						<div>
							<button className="text-button" type="button" onClick={() => { setEditingSiteId(site.id); setDraft({ name: site.name, type: site.type, url: site.url }); setError(""); }}>Edit</button>
							<button className="delete-supplier-button" type="button" disabled={isReferenced} title={isReferenced ? "Keep this template because sourcing requests reference it." : "Delete template"} onClick={() => {
								try { deleteSite(site.id); notify("Web sourcing template deleted."); }
								catch (deleteError) { notify(deleteError instanceof Error ? deleteError.message : "Could not delete template."); }
							}}>Delete</button>
						</div>
					</div>;
				})}</div>
			)}
			<p className="sourcing-safety-note">Connections are optional. Search URLs only create links; API connections are placeholders and make no network calls or store credentials.</p>
		</section>
	);
}

export default function SettingsApp() {
	const { inventorySettings } = useInventory();
	const { canManageInventory } = useUsers();

	return (
		<PageTemplate
			eyebrow="WORKSPACE / SETTINGS"
			title="Settings"
			description="Adjust inventory status and optional web sourcing connections."
		>
			{!canManageInventory ? (
				<section className="panel settings-restricted">
					<strong>Settings are managed by admins and managers.</strong>
					<p>Inventory thresholds and web sourcing connections can only be changed by managers and admins.</p>
				</section>
			) : (
				<>
					<InventoryThresholdSettings
						key={`${inventorySettings.lowStockThresholdEnabled}-${inventorySettings.defaultLowStockThreshold}`}
						settings={inventorySettings}
					/>
					<WebSourcingSettings />
				</>
			)}
		</PageTemplate>
	);
}
