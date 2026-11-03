import { getWorkspaceAccess } from "@/lib/supabase/access";

const IMPORT_KEYS = ["inventory", "suppliers", "settings", "legacy_profiles"] as const;

export async function POST(request: Request) {
	try {
		const access = await getWorkspaceAccess();
		if (!access || access.mustChangePassword || access.member.role !== "admin") {
			return Response.json({ message: "Only the workspace admin can import browser data." }, { status: 403 });
		}
		const body: unknown = await request.json();
		if (typeof body !== "object" || body === null || !IMPORT_KEYS.every((key) => key in body)) {
			return Response.json({ message: "The browser data import is incomplete." }, { status: 400 });
		}
		const { count, error: countError } = await access.admin.from("workspace_data").select("*", { count: "exact", head: true });
		if (countError) throw countError;
		if (count) return Response.json({ message: "The shared workspace already has data; import was not applied." }, { status: 409 });

		const rows = IMPORT_KEYS.map((key) => ({ data_key: key, data: (body as Record<string, unknown>)[key], version: 1 }));
		const { error } = await access.admin.from("workspace_data").insert(rows);
		if (error) {
			if (error.code === "23505") return Response.json({ message: "The shared workspace was initialized by another session." }, { status: 409 });
			throw error;
		}
		return Response.json({ message: "Browser data imported into the shared workspace." });
	} catch (error) {
		console.error("Could not import browser data.", error);
		return Response.json({ message: "Could not import browser data." }, { status: 500 });
	}
}
