import type { ReactNode } from "react";
import WorkspaceShell from "@/components/layout/workspace-shell";
import { InventoryProvider } from "@/components/providers/inventory-provider";
import { SupplierProvider } from "@/components/providers/supplier-provider";
import { WorkspaceDataProvider } from "@/components/providers/workspace-data-provider";
import { UserProvider } from "@/components/providers/user-provider";
import { createUserProfile } from "@/lib/workspace/user";
import { redirect } from "next/navigation";
import { getWorkspaceAccess } from "@/lib/supabase/access";

export const instant = false;

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
	const access = await getWorkspaceAccess();
	if (!access || access.member.role === "pending") redirect("/");
	if (access.mustChangePassword) redirect("/auth/password");
	return (
		<UserProvider initialUser={createUserProfile(access.member.user_id, access.member.display_name, access.member.role, access.user.email ?? "")}>
			<WorkspaceDataProvider>
				<SupplierProvider>
					<InventoryProvider>
						<WorkspaceShell>{children}</WorkspaceShell>
					</InventoryProvider>
				</SupplierProvider>
			</WorkspaceDataProvider>
		</UserProvider>
	);
}
