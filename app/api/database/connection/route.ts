import { getWorkspaceAccess } from "@/lib/supabase/access";

export async function POST() {
	if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
		return Response.json(
			{ message: "Configure the server-only SUPABASE_SERVICE_ROLE_KEY to enable workspace data." },
			{ status: 503 },
		);
	}
	try {
		const access = await getWorkspaceAccess();
		if (!access || access.mustChangePassword || !["admin", "manager"].includes(access.member.role)) {
			return Response.json({ message: "Only managers and admins can test the database connection." }, { status: 403 });
		}
		const { error } = await access.admin.from("workspace_data").select("data_key", { head: true, count: "exact" });
		if (error) {
			if (error.code === "42P01" || error.code === "PGRST205") {
				return Response.json({ message: "Supabase is reachable, but the workspace migration has not been applied." }, { status: 503 });
			}
			throw error;
		}
		return Response.json({ message: "Supabase connection and workspace schema are ready." });
	} catch (error) {
		console.error("Could not test the Supabase workspace connection.", error);
		return Response.json({ message: "Could not reach the Supabase workspace database." }, { status: 502 });
	}
}
