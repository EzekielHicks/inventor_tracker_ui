"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/ui/icon";
import { createClient } from "@/lib/supabase/client";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export default function Page() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const submit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError("");
		setSubmitting(true);
		try {
			const { error: signInError } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
			if (signInError) throw signInError;
			const response = await fetch("/api/account", { cache: "no-store" });
			const result: unknown = await response.json().catch(() => null);
			if (!response.ok) {
				const message = isRecord(result) && typeof result.message === "string" ? result.message : "Could not verify workspace access.";
				throw new Error(message);
			}
			const user = isRecord(result) ? result.user : null;
			if (isRecord(user) && user.role === "pending") {
				router.replace("/auth/pending");
				return;
			}
			if (!isRecord(user)) throw new Error("Your account does not have a workspace membership. Contact the workspace admin.");
			if (user.role !== "admin" && user.role !== "manager" && user.role !== "team_member") {
				throw new Error("Workspace access could not be verified. Contact the workspace admin.");
			}
			if (user.mustChangePassword === true) {
				router.replace("/auth/password");
				return;
			}
			router.replace("/overview");
		} catch (submitError) {
			setError(submitError instanceof Error ? submitError.message : "Could not authenticate your account.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<main className="auth-screen">
			<div className="user-picker-brand"><span className="brand-mark"><Icon name="box" size={21} /></span><span>stockroom<span className="brand-dot">.</span></span></div>
			<section className="auth-card">
				<span className="eyebrow">SHARED INVENTORY WORKSPACE</span>
				<h1>Sign in to Stockroom</h1>
				<p>Use your invited workspace account to continue.</p>
				<form className="auth-form" onSubmit={submit}>
					<label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
					<label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
					{error && <p className="form-error" role="alert">{error}</p>}
					<button className="primary-button" type="submit" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}</button>
				</form>
				<Link className="auth-mode-toggle" href="/signup">Create the workspace admin account</Link>
			</section>
		</main>
	);
}
