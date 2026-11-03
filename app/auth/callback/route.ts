import { NextResponse, type NextRequest } from "next/server";
import { getWorkspaceAccess } from "@/lib/supabase/access";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
	const code = request.nextUrl.searchParams.get("code");
	if (code) {
		try {
			const supabase = await createClient();
			const { error } = await supabase.auth.exchangeCodeForSession(code);
			if (error) throw error;
			const access = await getWorkspaceAccess();
			if (access) {
				const target = access.mustChangePassword
					? "/auth/password"
					: access.member.role === "pending"
						? "/auth/pending"
						: "/overview";
				return NextResponse.redirect(new URL(target, request.url));
			}
			return NextResponse.redirect(new URL("/auth/membership-error", request.url));
		} catch (error) {
			console.error("Could not complete the Supabase authentication callback.", error);
			return NextResponse.redirect(new URL("/auth/confirmation-error", request.url));
		}
	}
	return NextResponse.redirect(new URL("/auth/confirmation-error", request.url));
}
