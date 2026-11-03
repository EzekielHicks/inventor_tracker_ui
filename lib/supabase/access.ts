import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type WorkspaceRole = "admin" | "manager" | "team_member" | "pending";

function isWorkspaceRole(role: string): role is WorkspaceRole {
	return ["admin", "manager", "team_member", "pending"].includes(role);
}

export async function getWorkspaceAccess() {
	const supabase = await createClient();
	const { data: { user }, error: authError } = await supabase.auth.getUser();
	if (authError?.name === "AuthSessionMissingError") return null;
	if (authError) throw authError;
	if (!user) return null;

	const admin = createAdminClient();
	const { data: member, error } = await admin
		.from("workspace_members")
		.select("user_id, display_name, role")
		.eq("user_id", user.id)
		.maybeSingle();
	if (error) throw error;
	if (!member) return null;
	if (!isWorkspaceRole(member.role)) throw new Error("The workspace account has an invalid role.");
	return {
		user,
		member,
		admin,
		mustChangePassword: user.user_metadata?.must_change_password === true,
	};
}
