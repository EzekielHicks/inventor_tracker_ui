"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/icon";
import { createClient } from "@/lib/supabase/client";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export default function SignupPage() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmation, setConfirmation] = useState("");
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const [confirmationEmail, setConfirmationEmail] = useState("");
	const [resending, setResending] = useState(false);
	const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	const submit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError("");
		setMessage("");
		if (!name.trim()) {
			setError("Enter your name.");
			return;
		}
		if (password !== confirmation) {
			setError("The passwords do not match.");
			return;
		}
		setSubmitting(true);
		try {
			const { data, error: signUpError } = await createClient().auth.signUp({
				email: email.trim(),
				password,
				options: {
					data: { display_name: name.trim() },
					emailRedirectTo: `${window.location.origin}/auth/callback`,
				},
			});
			if (signUpError) throw signUpError;
			if (!data.user) throw new Error("Supabase did not return a user after signup.");
			if (!data.session) {
				setConfirmationEmail(email.trim());
				setMessage(data.user.identities?.length === 0
					? "An account may already exist for this email. You can try signing in or request another confirmation email if it is not confirmed."
					: "Signup was accepted, but workspace access starts after email confirmation. Check your inbox and spam folder. If no email arrives, check Supabase email provider and SMTP settings.");
				setAwaitingConfirmation(true);
				return;
			}

			const response = await fetch("/api/account", { cache: "no-store" });
			const result: unknown = await response.json().catch(() => null);
			if (!response.ok) {
				const message = isRecord(result) && typeof result.message === "string" ? result.message : "Account created, but workspace access could not be verified. Sign in again or contact the workspace admin.";
				throw new Error(message);
			}
			const user = isRecord(result) ? result.user : null;
			if (!isRecord(user)) throw new Error("Account created, but workspace membership was not found. Check that the Supabase migration has been applied.");
			if (user.role === "pending") {
				router.replace("/auth/pending");
				return;
			}
			if (user.role !== "admin" && user.role !== "manager" && user.role !== "team_member") {
				throw new Error("Workspace access could not be verified. Check that the migration is applied and try signing in again.");
			}
			if (user.mustChangePassword === true) {
				router.replace("/auth/password");
				return;
			}
			router.replace("/overview");
		} catch (signupError) {
			setError(signupError instanceof Error ? signupError.message : "Could not create your account.");
		} finally {
			setSubmitting(false);
		}
	};

	const resendConfirmation = async () => {
		setError("");
		setMessage("");
		setResending(true);
		try {
			const { error: resendError } = await createClient().auth.resend({
				type: "signup",
				email: confirmationEmail,
				options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
			});
			if (resendError) throw resendError;
			setMessage("If this address has an unconfirmed account, Supabase has queued a new confirmation email. Check your inbox and spam folder.");
		} catch (resendError) {
			setError(resendError instanceof Error ? resendError.message : "Could not resend the confirmation email.");
		} finally {
			setResending(false);
		}
	};

	return (
		<main className="auth-screen">
			<div className="user-picker-brand"><span className="brand-mark"><Icon name="box" size={21} /></span><span>stockroom<span className="brand-dot">.</span></span></div>
			<section className="auth-card">
				{awaitingConfirmation ? (
					<>
						<span className="eyebrow">EMAIL CONFIRMATION</span>
						<h1>Check your email</h1>
						<p>{message}</p>
						<p>Confirmation sent to <strong>{confirmationEmail}</strong>. Open the link in that email to finish creating your workspace account.</p>
						{error && <p className="form-error" role="alert">{error}</p>}
						<button className="primary-button" type="button" disabled={resending} onClick={() => void resendConfirmation()}>{resending ? "Requesting email…" : "Resend confirmation email"}</button>
						<Link className="auth-mode-toggle" href="/">Return to sign in</Link>
					</>
				) : (
					<>
						<span className="eyebrow">SHARED INVENTORY WORKSPACE</span>
						<h1>Create the workspace admin account</h1>
						<p>The first account becomes the workspace admin. Additional accounts need an admin invitation or approval.</p>
						<form className="auth-form" onSubmit={submit}>
							<label>Your name<input autoComplete="name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label>
							<label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
							<label>Password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
							<label>Confirm password<input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
							{error && <p className="form-error" role="alert">{error}</p>}
							<button className="primary-button" type="submit" disabled={submitting}>{submitting ? "Creating account…" : "Create admin account"}</button>
						</form>
						<Link className="auth-mode-toggle" href="/">Already have an account? Sign in</Link>
					</>
				)}
			</section>
		</main>
	);
}
