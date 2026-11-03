import { connection } from "next/server";
import { getWorkspaceAccess } from "@/lib/supabase/access";

type AssignableRole = "manager" | "team_member" | "pending";

function isAssignableRole(role: unknown): role is AssignableRole {
	return role === "manager" || role === "team_member" || role === "pending";
}

export async function GET() {
	await connection();
	try {
		const access = await getWorkspaceAccess();
		if (!access || access.mustChangePassword || !["admin", "manager"].includes(access.member.role)) {
			return Response.json({ message: "Only managers and admins can view workspace accounts." }, { status: 403 });
		}
		const { data, error } = await access.admin.from("workspace_members")
			.select("user_id, display_name, role").order("created_at");
		if (error) throw error;
		return Response.json({ members: data });
	} catch (error) {
		console.error("Could not load workspace accounts.", error);
		return Response.json({ message: "Could not load workspace accounts." }, { status: 500 });
	}
}

export async function POST(request: Request) {
	try {
		const access = await getWorkspaceAccess();
		if (!access || access.mustChangePassword || access.member.role !== "admin") {
			return Response.json({ message: "Only an admin can invite workspace accounts." }, { status: 403 });
		}
		const body: unknown = await request.json();
		if (typeof body !== "object" || body === null || !("email" in body) || typeof body.email !== "string"
			|| !("name" in body) || typeof body.name !== "string"
			|| !("role" in body) || (body.role !== "manager" && body.role !== "team_member")) {
			return Response.json({ message: "Enter an email, name, and valid workspace role." }, { status: 400 });
		}
		const email = body.email.trim().toLowerCase();
		const name = body.name.trim().replace(/\s+/g, " ");
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name || name.length > 80) {
			return Response.json({ message: "Enter a valid email address and a name under 80 characters." }, { status: 400 });
		}
		const origin = new URL(request.url).origin;
		const { data, error } = await access.admin.auth.admin.inviteUserByEmail(email, {
			data: { display_name: name, must_change_password: true },
			redirectTo: `${origin}/auth/callback`,
		});
		if (error) {
			return Response.json({ message: error.message }, { status: 400 });
		}
		const { data: member, error: updateError } = await access.admin.from("workspace_members")
			.update({ display_name: name, role: body.role }).eq("user_id", data.user.id)
			.select("user_id").maybeSingle();
		if (updateError) throw updateError;
		if (!member) {
			return Response.json(
				{ message: "The invitation was sent, but workspace membership could not be assigned. Verify that the workspace migration is applied." },
				{ status: 500 },
			);
		}
		return Response.json({ message: `Invitation sent to ${email}.` });
	} catch (error) {
		console.error("Could not invite workspace account.", error);
		return Response.json({ message: "Could not invite the workspace account." }, { status: 500 });
	}
}

export async function PATCH(request: Request) {
	try {
		const access = await getWorkspaceAccess();
		if (!access || access.mustChangePassword || access.member.role !== "admin") {
			return Response.json({ message: "Only an admin can change workspace roles." }, { status: 403 });
		}
		const body: unknown = await request.json();
		if (typeof body !== "object" || body === null || !("userId" in body) || typeof body.userId !== "string"
			|| !("role" in body) || !isAssignableRole(body.role)) {
			return Response.json({ message: "Choose a valid workspace account and role." }, { status: 400 });
		}
		if (body.userId === access.user.id) {
			return Response.json({ message: "You cannot change your own workspace role." }, { status: 400 });
		}
		const { data, error } = await access.admin.from("workspace_members")
			.update({ role: body.role }).eq("user_id", body.userId).neq("role", "admin")
			.select("user_id").maybeSingle();
		if (error) throw error;
		if (!data) return Response.json({ message: "The account was not found or is an admin." }, { status: 404 });
		return Response.json({ message: "Workspace role updated." });
	} catch (error) {
		console.error("Could not update workspace role.", error);
		return Response.json({ message: "Could not update workspace role." }, { status: 500 });
	}
}
