import { connection } from "next/server";
import { getWorkspaceAccess } from "@/lib/supabase/access";

export async function GET() {
	await connection();
	try {
		const access = await getWorkspaceAccess();
		if (!access) return Response.json({ user: null });
		return Response.json({
			user: {
				id: access.member.user_id,
				name: access.member.display_name,
				role: access.member.role,
				email: access.user.email ?? "",
				mustChangePassword: access.mustChangePassword,
			},
		});
	} catch (error) {
		console.error("Could not load workspace account.", error);
		return Response.json({ message: "Could not load the workspace account." }, { status: 500 });
	}
}
