"use client";

import { useEffect, useState, type FormEvent } from "react";
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

	const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError("");
		if (!Number.isSafeInteger(draft.defaultLowStockThreshold) || draft.defaultLowStockThreshold < 1) {
			setError("Enter a positive whole number for the low-stock threshold.");
			return;
		}
		try {
			await updateInventorySettings(draft);
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

function DatabaseConnectionSettings() {
	const [status, setStatus] = useState<"disconnected" | "testing" | "tested" | "connected" | "error">("disconnected");
	const [message, setMessage] = useState("");

	const checkConnection = async (connect: boolean) => {
		setStatus("testing");
		setMessage("");
		try {
			const response = await fetch("/api/database/connection", { method: "POST" });
			const result: unknown = await response.json();
			if (!response.ok) {
				const errorMessage = typeof result === "object" && result !== null && "message" in result && typeof result.message === "string"
					? result.message
					: "Could not test the Supabase connection.";
				throw new Error(errorMessage);
			}
			setStatus(connect ? "connected" : "tested");
			setMessage(connect ? "Connected to Supabase." : "Connection test passed.");
		} catch (error) {
			setStatus("error");
			setMessage(error instanceof Error ? error.message : "Could not test the Supabase connection.");
		}
	};

	return (
		<section className="panel database-connection-settings">
			<div className="panel-heading">
				<div><h2>Database connection</h2><p>Test or connect to the configured Supabase project.</p></div>
				<span className={`database-connection-status database-connection-status-${status}`} role="status">
					{status === "testing" ? "Checking…" : status === "connected" ? "Connected" : status === "tested" ? "Available" : status === "error" ? "Connection failed" : "Not connected"}
				</span>
			</div>
			<p className="database-connection-message">{message || "Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to enable a connection."}</p>
			<div className="settings-actions">
				<button className="secondary-button" type="button" disabled={status === "testing"} onClick={() => void checkConnection(false)}>Test connection</button>
				<button className="primary-button" type="button" disabled={status === "testing"} onClick={() => void checkConnection(true)}>{status === "testing" ? "Connecting…" : "Connect database"}</button>
			</div>
			<p className="database-connection-note">The shared workspace uses Supabase Auth and row-level security. Apply the migration and configure the server-only service role key before inviting users.</p>
		</section>
	);
}

type WorkspaceMember = { user_id: string; display_name: string; role: "admin" | "manager" | "team_member" | "pending" };

function isWorkspaceMember(member: unknown): member is WorkspaceMember {
	return typeof member === "object" && member !== null
		&& "user_id" in member && typeof member.user_id === "string"
		&& "display_name" in member && typeof member.display_name === "string"
		&& "role" in member && ["admin", "manager", "team_member", "pending"].includes(String(member.role));
}

async function fetchWorkspaceMembers(): Promise<WorkspaceMember[]> {
	const response = await fetch("/api/accounts", { cache: "no-store" });
	const result: unknown = await response.json();
	if (!response.ok || typeof result !== "object" || result === null || !("members" in result) || !Array.isArray(result.members)) {
		throw new Error(typeof result === "object" && result !== null && "message" in result && typeof result.message === "string" ? result.message : "Could not load workspace accounts.");
	}
	if (!result.members.every(isWorkspaceMember)) {
		throw new Error("The workspace account list is invalid.");
	}
	return result.members;
}

function WorkspaceAccountsSettings() {
	const { activeUser } = useUsers();
	const [members, setMembers] = useState<WorkspaceMember[]>([]);
	const [email, setEmail] = useState("");
	const [name, setName] = useState("");
	const [role, setRole] = useState<"manager" | "team_member">("team_member");
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	const loadMembers = async () => setMembers(await fetchWorkspaceMembers());

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			try {
				const loadedMembers = await fetchWorkspaceMembers();
				if (!cancelled) setMembers(loadedMembers);
			} catch (loadError) {
				if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load workspace accounts.");
			}
		};
		void load();
		return () => { cancelled = true; };
	}, []);

	const inviteMember = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setBusy(true);
		setError("");
		setMessage("");
		try {
			const response = await fetch("/api/accounts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, name, role }),
			});
			const result: unknown = await response.json();
			if (!response.ok) throw new Error(typeof result === "object" && result !== null && "message" in result && typeof result.message === "string" ? result.message : "Could not send invitation.");
			setMessage(typeof result === "object" && result !== null && "message" in result && typeof result.message === "string" ? result.message : "Invitation sent.");
			setEmail("");
			setName("");
			await loadMembers();
		} catch (inviteError) {
			setError(inviteError instanceof Error ? inviteError.message : "Could not send invitation.");
		} finally {
			setBusy(false);
		}
	};

	const updateRole = async (userId: string, nextRole: WorkspaceMember["role"]) => {
		setError("");
		try {
			const response = await fetch("/api/accounts", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId, role: nextRole }),
			});
			const result: unknown = await response.json();
			if (!response.ok) throw new Error(typeof result === "object" && result !== null && "message" in result && typeof result.message === "string" ? result.message : "Could not update account role.");
			await loadMembers();
		} catch (updateError) {
			setError(updateError instanceof Error ? updateError.message : "Could not update account role.");
		}
	};

	return (
		<section className="panel workspace-accounts-settings">
			<div className="panel-heading"><div><h2>Workspace accounts</h2><p>Invite teammates and manage their access.</p></div></div>
			{activeUser.role === "Admin" && <form className="workspace-invite-form" onSubmit={inviteMember}>
				<label>Name<input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label>
				<label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
				<label>Role<select value={role} onChange={(event) => setRole(event.target.value as typeof role)}><option value="team_member">Team member</option><option value="manager">Manager</option></select></label>
				<button className="primary-button" type="submit" disabled={busy}>{busy ? "Sending…" : "Invite teammate"}</button>
			</form>}
			{error && <p className="form-error" role="alert">{error}</p>}
			{message && <p className="auth-message" role="status">{message}</p>}
			<div className="workspace-member-list">{members.map((member) => <div className="workspace-member-row" key={member.user_id}>
				<strong>{member.display_name}</strong>
				{activeUser.role === "Admin" && member.user_id !== activeUser.id && member.role !== "admin"
					? <select aria-label={`Role for ${member.display_name}`} value={member.role} onChange={(event) => void updateRole(member.user_id, event.target.value as WorkspaceMember["role"])}><option value="pending">Pending</option><option value="team_member">Team member</option><option value="manager">Manager</option></select>
					: <span>{member.role === "team_member" ? "Team member" : member.role === "pending" ? "Pending access" : member.role[0].toUpperCase() + member.role.slice(1)}</span>}
			</div>)}</div>
			<p className="database-connection-note">New accounts require an email invitation. The first registered account becomes the workspace admin.</p>
		</section>
	);
}

function WebSourcingSettings() {
	const { sites, requests, addSite, updateSite, deleteSite } = useSuppliers();
	const notify = useNotify();
	const [draft, setDraft] = useState<SiteDraft>(emptySite);
	const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
	const [error, setError] = useState("");

	const saveSite = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError("");
		try {
			if (editingSiteId) await updateSite(editingSiteId, draft);
			else await addSite(draft);
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
							<button className="delete-supplier-button" type="button" disabled={isReferenced} title={isReferenced ? "Keep this template because sourcing requests reference it." : "Delete template"} onClick={async () => {
								try { await deleteSite(site.id); notify("Web sourcing template deleted."); }
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
					<DatabaseConnectionSettings />
					<WorkspaceAccountsSettings />
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
