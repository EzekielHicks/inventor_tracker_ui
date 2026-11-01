"use client";

import Icon, { type IconName } from "@/components/ui/icon";
import Link from "next/link";
import { useUsers } from "@/components/providers/user-provider";
import { useInventory } from "@/components/providers/inventory-provider";

export type SidebarNav = "Overview" | "Inventory" | "Analytics" | "Suppliers" | "Settings";

type SidebarProps = {
	activeNav: SidebarNav;
	collapsed: boolean;
	onToggleCollapsed: () => void;
	onSwitchUser: () => void;
	notify: (message: string) => void;
};

const navigationItems: { label: SidebarNav; icon: IconName; href: string }[] = [
	{ label: "Overview", icon: "grid", href: "/overview" },
	{ label: "Inventory", icon: "box", href: "/inventory" },
	{ label: "Analytics", icon: "chart", href: "/analytics" },
	{ label: "Suppliers", icon: "users", href: "/suppliers" },
];

export default function Sidebar({ activeNav, collapsed, onToggleCollapsed, onSwitchUser, notify }: SidebarProps) {
	const { activeUser, canManageSuppliers, canManageInventory } = useUsers();
	const { stockOnHand } = useInventory();
	const visibleNavigationItems = navigationItems.filter(({ label }) => label !== "Suppliers" || canManageSuppliers);

	return (
		<aside className="sidebar">
			<div className="sidebar-brand-row">
				<Link className="brand" href="/overview" aria-label="Stockroom overview"><span className="brand-mark"><Icon name="box" size={21} /></span><span className="sidebar-label">stockroom<span className="brand-dot">.</span></span></Link>
				<button className="sidebar-toggle" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-pressed={collapsed} onClick={onToggleCollapsed}><Icon name="chevron" size={16} /></button>
			</div>
			<div className="workspace-label sidebar-label">WORKSPACE</div>

			<nav className="nav-list" aria-label="Main navigation">
				{visibleNavigationItems.map(({ label, icon, href }) => (
					<Link key={label} href={href} title={collapsed ? label : undefined} aria-current={activeNav === label ? "page" : undefined} className={`nav-item ${activeNav === label ? "nav-active" : ""}`}>
						<Icon name={icon} />
						<span className="sidebar-label">{label}</span>
						{label === "Inventory" && <span className="nav-count" title="Total units in inventory">{stockOnHand.toLocaleString()}</span>}
					</Link>
				))}
			</nav>

			<div className="sidebar-bottom">
				<div className="help-card"><div className="help-icon">✦</div><strong className="sidebar-label">Need a hand?</strong><p className="sidebar-label">Visit our help center for tips and answers.</p><button onClick={() => notify("Help center is coming soon")}><span className="sidebar-label">Get help</span><span>↗</span></button></div>
				{canManageInventory && <Link className={`nav-item settings-link ${activeNav === "Settings" ? "nav-active" : ""}`} aria-current={activeNav === "Settings" ? "page" : undefined} href="/settings" title={collapsed ? "Settings" : undefined}><Icon name="settings" /><span className="sidebar-label">Settings</span></Link>}
				<button className="profile" onClick={onSwitchUser} title="Switch user">
					<div className={`avatar ${activeUser.avatarColor}`}>{activeUser.initials}</div>
					<div className="profile-copy sidebar-label"><strong>{activeUser.name}</strong><span>{activeUser.role}</span></div>
					<span className="profile-more sidebar-label" aria-hidden="true"><Icon name="more" /></span>
				</button>
			</div>
		</aside>
	);
}
