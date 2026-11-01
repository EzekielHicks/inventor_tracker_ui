"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

export type UserProfile = {
	id: string;
	name: string;
	initials: string;
	role: string;
	avatarColor: string;
};

export type UserRole = "Admin" | "Manager" | "Team Member";

const defaultUsers: UserProfile[] = [
	{ id: "jordan", name: "Jordan Davis", initials: "JD", role: "Manager", avatarColor: "avatar-jordan" },
	{ id: "alex", name: "Alex Morgan", initials: "AM", role: "Manager", avatarColor: "avatar-alex" },
	{ id: "taylor", name: "Taylor Reed", initials: "TR", role: "Team Member", avatarColor: "avatar-taylor" },
];

const USERS_KEY = "stockroom.users";
const ACTIVE_USER_KEY = "stockroom.activeUser";
const CHANGE_EVENT = "stockroom-user-store-change";

type UserContextValue = {
	users: UserProfile[];
	activeUser: UserProfile;
	canManageInventory: boolean;
	canManageSuppliers: boolean;
	canReviewOrders: boolean;
	addUser: (name: string, role: UserRole) => UserProfile;
	removeUser: (id: string) => void;
	selectUser: (id: string) => void;
};

const UserContext = createContext<UserContextValue | null>(null);
let usersSnapshot = defaultUsers;
let activeUserIdSnapshot = defaultUsers[0].id;
let storageInitialized = false;

function isUserProfile(value: unknown): value is UserProfile {
	if (!value || typeof value !== "object") return false;
	return "id" in value && typeof value.id === "string"
		&& "name" in value && typeof value.name === "string"
		&& "initials" in value && typeof value.initials === "string"
		&& "role" in value && typeof value.role === "string"
		&& "avatarColor" in value && typeof value.avatarColor === "string";
}

function loadStorage() {
	if (storageInitialized || typeof window === "undefined") return;
	storageInitialized = true;
	usersSnapshot = defaultUsers;
	activeUserIdSnapshot = defaultUsers[0].id;
	try {
		const storedUsers = localStorage.getItem(USERS_KEY);
		if (storedUsers) {
			const parsed: unknown = JSON.parse(storedUsers);
			if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isUserProfile)) {
				usersSnapshot = parsed;
			} else {
				console.error("Saved user profiles are invalid; using the default profile.");
			}
		}
		activeUserIdSnapshot = localStorage.getItem(ACTIVE_USER_KEY) ?? defaultUsers[0].id;
	} catch (error) {
		console.error("Could not load saved user profiles.", error);
	}
}

function subscribe(callback: () => void) {
	if (typeof window === "undefined") return () => {};
	const onStorageChange = (event: StorageEvent) => {
		if (event.key !== USERS_KEY && event.key !== ACTIVE_USER_KEY) return;
		storageInitialized = false;
		loadStorage();
		callback();
	};
	window.addEventListener("storage", onStorageChange);
	window.addEventListener(CHANGE_EVENT, callback);
	return () => {
		window.removeEventListener("storage", onStorageChange);
		window.removeEventListener(CHANGE_EVENT, callback);
	};
}

function getUsersSnapshot() {
	loadStorage();
	return usersSnapshot;
}

function getActiveUserIdSnapshot() {
	loadStorage();
	return activeUserIdSnapshot;
}

function updateUsers(users: UserProfile[]) {
	usersSnapshot = users;
	try {
		localStorage.setItem(USERS_KEY, JSON.stringify(users));
		window.dispatchEvent(new Event(CHANGE_EVENT));
	} catch (error) {
		console.error("Could not save user profiles.", error);
		throw error;
	}
}

function updateActiveUserId(id: string) {
	activeUserIdSnapshot = id;
	try {
		localStorage.setItem(ACTIVE_USER_KEY, id);
		window.dispatchEvent(new Event(CHANGE_EVENT));
	} catch (error) {
		console.error("Could not save the selected user.", error);
		throw error;
	}
}

function removeUser(id: string) {
	const currentUsers = getUsersSnapshot();
	if (!currentUsers.some((user) => user.id === id)) {
		throw new Error("This user profile no longer exists.");
	}
	if (currentUsers.length <= 1) {
		throw new Error("At least one user profile must remain.");
	}

	const nextUsers = currentUsers.filter((user) => user.id !== id);
	const nextActiveUserId = activeUserIdSnapshot === id ? nextUsers[0].id : activeUserIdSnapshot;
	try {
		if (nextActiveUserId !== activeUserIdSnapshot) {
			localStorage.setItem(ACTIVE_USER_KEY, nextActiveUserId);
		}
		localStorage.setItem(USERS_KEY, JSON.stringify(nextUsers));
		usersSnapshot = nextUsers;
		activeUserIdSnapshot = nextActiveUserId;
		window.dispatchEvent(new Event(CHANGE_EVENT));
	} catch (error) {
		console.error("Could not remove the user profile.", error);
		throw error;
	}
}

export function UserProvider({ children }: { children: ReactNode }) {
	const users = useSyncExternalStore(subscribe, getUsersSnapshot, () => defaultUsers);
	const activeUserId = useSyncExternalStore(subscribe, getActiveUserIdSnapshot, () => defaultUsers[0].id);
	const activeUser = users.find((user) => user.id === activeUserId) ?? users[0] ?? defaultUsers[0];
	const canManage = ["Admin", "Manager", "Store Admin", "Inventory Manager"].includes(activeUser.role);
	const value: UserContextValue = {
		users,
		activeUser,
		canManageInventory: canManage,
		canManageSuppliers: canManage,
		canReviewOrders: canManage,
		addUser: (name, role) => {
			const normalizedName = name.trim().replace(/\s+/g, " ");
			if (!normalizedName) throw new Error("A user profile name is required.");
			const parts = normalizedName.split(" ");
			const initials = parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
			const profile: UserProfile = {
				id: `user-${crypto.randomUUID()}`,
				name: normalizedName,
				initials,
				role,
				avatarColor: ["avatar-jordan", "avatar-alex", "avatar-taylor"][usersSnapshot.length % 3],
			};
			updateUsers([...getUsersSnapshot(), profile]);
			updateActiveUserId(profile.id);
			return profile;
		},
		removeUser,
		selectUser: (id) => {
			if (!getUsersSnapshot().some((user) => user.id === id)) {
				throw new Error(`Cannot select unknown user: ${id}`);
			}
			updateActiveUserId(id);
		},
	};

	return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUsers() {
	const context = useContext(UserContext);
	if (!context) throw new Error("useUsers must be used within UserProvider.");
	return context;
}
