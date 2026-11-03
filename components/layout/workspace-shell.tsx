"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Icon from "@/components/ui/icon";
import Sidebar, { type SidebarNav } from "@/components/dashboard/sidebar";
import { useUsers } from "@/components/providers/user-provider";
import { useSuppliers } from "@/components/providers/supplier-provider";

type NotificationContextValue = (message: string) => void;

const NotificationContext = createContext<NotificationContextValue | null>(null);
const COLLAPSED_KEY = "stockroom.sidebarCollapsed";
const COLLAPSED_CHANGE_EVENT = "stockroom-sidebar-preference-change";

let collapsedSnapshot = false;
let collapsedInitialized = false;

const routeTitles: Record<string, SidebarNav> = {
	"/overview": "Overview",
	"/inventory": "Inventory",
	"/analytics": "Analytics",
	"/suppliers": "Suppliers",
	"/settings": "Settings",
};

function getCollapsedSnapshot() {
	if (!collapsedInitialized && typeof window !== "undefined") {
		collapsedInitialized = true;
		try {
			collapsedSnapshot = localStorage.getItem(COLLAPSED_KEY) === "true";
		} catch (error) {
			console.error("Could not load sidebar preference.", error);
		}
	}
	return collapsedSnapshot;
}

function subscribeToCollapsedPreference(callback: () => void) {
	const onStorageChange = (event: StorageEvent) => {
		if (event.key !== COLLAPSED_KEY) return;
		collapsedInitialized = false;
		getCollapsedSnapshot();
		callback();
	};
	window.addEventListener("storage", onStorageChange);
	window.addEventListener(COLLAPSED_CHANGE_EVENT, callback);
	return () => {
		window.removeEventListener("storage", onStorageChange);
		window.removeEventListener(COLLAPSED_CHANGE_EVENT, callback);
	};
}

function toggleCollapsedPreference() {
	collapsedSnapshot = !getCollapsedSnapshot();
	collapsedInitialized = true;
	try {
		localStorage.setItem(COLLAPSED_KEY, String(collapsedSnapshot));
	} catch (error) {
		console.error("Could not save sidebar preference.", error);
	}
	window.dispatchEvent(new Event(COLLAPSED_CHANGE_EVENT));
}

export function useNotify() {
	const notify = useContext(NotificationContext);
	if (!notify) throw new Error("useNotify must be used within WorkspaceShell.");
	return notify;
}

export default function WorkspaceShell({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const router = useRouter();
	const { activeUser, canReviewOrders, signOut } = useUsers();
	const { requests } = useSuppliers();
	const collapsed = useSyncExternalStore(subscribeToCollapsedPreference, getCollapsedSnapshot, () => false);
	const [notice, setNotice] = useState("");
	const activeNav = routeTitles[pathname] ?? "Overview";
	const openOrderRequests = canReviewOrders ? requests.filter((request) => ["Pending review", "Sourcing approved", "Approved"].includes(request.status)).length : 0;
	const notificationLabel = openOrderRequests === 1 ? "1 open order request" : `${openOrderRequests} open order requests`;

	useEffect(() => {
		if (!notice) return;
		const timeout = window.setTimeout(() => setNotice(""), 2800);
		return () => window.clearTimeout(timeout);
	}, [notice]);

	const notify = useMemo(() => (message: string) => setNotice(message), []);
	const handleSignOut = async () => {
		try {
			await signOut();
			router.replace("/");
		} catch (error) {
			notify(error instanceof Error ? error.message : "Could not sign out.");
		}
	};

	return (
		<NotificationContext.Provider value={notify}>
			<div className={`app-shell workspace-shell${collapsed ? " sidebar-collapsed" : ""}`}>
				<Sidebar
					activeNav={activeNav}
					collapsed={collapsed}
					onToggleCollapsed={toggleCollapsedPreference}
					onSignOut={() => void handleSignOut()}
					notify={notify}
				/>
				<section className="main-area">
					<header className="topbar">
						<div className="breadcrumb">Workspace <Icon name="chevron" size={14} /><strong>{activeNav}</strong></div>
						<div className="top-actions">
							<div className="store-select"><span className="store-dot" /> Main Store <span className="down-caret">⌄</span></div>
							<button className="icon-button notification-button" aria-label={openOrderRequests ? notificationLabel : "Notifications"} onClick={() => openOrderRequests ? router.push("/suppliers") : notify("You’re all caught up!")}><Icon name="bell" /><i />{openOrderRequests > 0 && <span className="notification-count">{openOrderRequests}</span>}</button>
							<button className={`top-avatar ${activeUser.avatarColor}`} aria-label={`Sign out ${activeUser.name}`} onClick={() => void handleSignOut()}>{activeUser.initials}</button>
						</div>
					</header>
					{children}
				</section>
				{notice && <div className="toast" role="status">{notice}</div>}
			</div>
		</NotificationContext.Provider>
	);
}
