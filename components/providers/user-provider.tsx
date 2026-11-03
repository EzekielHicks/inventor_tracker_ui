"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile } from "@/lib/workspace/user";

type UserContextValue = {
	activeUser: UserProfile;
	canManageInventory: boolean;
	canManageSuppliers: boolean;
	canReviewOrders: boolean;
	signOut: () => Promise<void>;
};

const signedOutUser: UserProfile = {
	id: "",
	name: "Guest",
	initials: "GU",
	role: "Pending",
	avatarColor: "avatar-jordan",
	email: "",
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children, initialUser }: { children: ReactNode; initialUser: UserProfile }) {
	const [activeUser, setActiveUser] = useState(initialUser);

	const signOut = useCallback(async () => {
		const { error } = await createClient().auth.signOut();
		if (error) throw error;
		setActiveUser(signedOutUser);
	}, []);
	const canManage = activeUser.role === "Admin" || activeUser.role === "Manager";
	const value = useMemo(() => ({
		activeUser,
		canManageInventory: canManage,
		canManageSuppliers: canManage,
		canReviewOrders: canManage,
		signOut,
	}), [activeUser, canManage, signOut]);

	return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUsers() {
	const context = useContext(UserContext);
	if (!context) throw new Error("useUsers must be used within UserProvider.");
	return context;
}
