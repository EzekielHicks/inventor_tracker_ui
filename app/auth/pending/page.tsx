"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/icon";
import { createClient } from "@/lib/supabase/client";

export default function PendingAccessPage() {
	const router = useRouter();
	const [error, setError] = useState("");
	const [signingOut, setSigningOut] = useState(false);

	const signOut = async () => {
		setError("");
		setSigningOut(true);
		try {
			const { error: signOutError } = await createClient().auth.signOut();
			if (signOutError) throw signOutError;
			router.replace("/");
		} catch (signOutError) {
			setError(signOutError instanceof Error ? signOutError.message : "Could not sign out.");
		} finally {
			setSigningOut(false);
		}
	};

	return (
		<main className="auth-screen">
			<div className="user-picker-brand"><span className="brand-mark"><Icon name="box" size={21} /></span><span>stockroom<span className="brand-dot">.</span></span></div>
			<section className="auth-card">
				<span className="eyebrow">ACCOUNT CREATED</span>
				<h1>Workspace access pending</h1>
				<p>This account is not the first workspace account. Ask an admin to invite or approve your account.</p>
				{error && <p className="form-error" role="alert">{error}</p>}
				<button className="auth-mode-toggle" type="button" disabled={signingOut} onClick={() => void signOut()}>
					{signingOut ? "Signing out…" : "Sign out and return to sign in"}
				</button>
			</section>
		</main>
	);
}
