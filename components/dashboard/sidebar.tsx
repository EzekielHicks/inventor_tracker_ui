"use client";

import Icon, { type IconName } from "@/components/ui/icon";

export type SidebarNav = "Overview" | "Inventory" | "Analytics" | "Suppliers";

type SidebarProps = {
	activeNav: SidebarNav;
	onActiveNavChange: (label: SidebarNav) => void;
	notify: (message: string) => void;
};

const navigationItems: { label: SidebarNav; icon: IconName }[] = [
	{ label: "Overview", icon: "grid" },
	{ label: "Inventory", icon: "box" },
	{ label: "Analytics", icon: "chart" },
	{ label: "Suppliers", icon: "users" },
];

export default function Sidebar({ activeNav, onActiveNavChange, notify }: SidebarProps) {
	return (
		<aside className="sidebar">
			<a className="brand" href="#overview" aria-label="Stockroom home"><span className="brand-mark"><Icon name="box" size={21} /></span><span>stockroom<span className="brand-dot">.</span></span></a>
			<div className="workspace-label">WORKSPACE</div>

			<nav className="nav-list" aria-label="Main navigation">
				{navigationItems.map(({ label, icon }) => (
					<button key={label} className={`nav-item ${activeNav === label ? "nav-active" : ""}`} onClick={() => { onActiveNavChange(label); if (label !== "Overview") notify(`${label} view selected`); }}>
						<Icon name={icon} />
						<span>{label}</span>
						{label === "Inventory" && <span className="nav-count">0</span>}
					</button>
				))}
			</nav>

			<div className="sidebar-bottom">
				<div className="help-card"><div className="help-icon">✦</div><strong>Need a hand?</strong><p>Visit our help center for tips and answers.</p><button onClick={() => notify("Help center is coming soon")}>Get help <span>↗</span></button></div>
				<button className="nav-item settings-link" onClick={() => notify("Settings are coming soon")}><Icon name="settings" /><span>Settings</span></button>
				<div className="profile"><div className="avatar">JD</div><div className="profile-copy"><strong>Jordan Davis</strong><span>Store manager</span></div><button className="profile-more" aria-label="More profile options" onClick={() => notify("Signed in as Jordan Davis")}><Icon name="more" /></button></div>
			</div>
		</aside>
	);
}
