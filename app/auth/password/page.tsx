"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/icon";
import { createClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
	const router = useRouter();
	const [password, setPassword] = useState("");
	const [confirmation, setConfirmation] = useState("");
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);

	const submit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError("");
		if (password !== confirmation) {
			setError("The passwords do not match.");
			return;
		}
		setSaving(true);
		try {
			const { error: updateError } = await createClient().auth.updateUser({
				password,
				data: { must_change_password: false },
			});
			if (updateError) throw updateError;
			router.replace("/overview");
		} catch (saveError) {
			setError(saveError instanceof Error ? saveError.message : "Could not set your password.");
		} finally {
			setSaving(false);
		}
	};

	return (
		<main className="auth-screen">
			<div className="user-picker-brand"><span className="brand-mark"><Icon name="box" size={21} /></span><span>stockroom<span className="brand-dot">.</span></span></div>
			<section className="auth-card">
				<span className="eyebrow">ACCOUNT SETUP</span>
				<h1>Set your password</h1>
				<p>Choose a password to finish joining the shared workspace.</p>
				<form className="auth-form" onSubmit={submit}>
					<label>New password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
					<label>Confirm password<input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
					{error && <p className="form-error" role="alert">{error}</p>}
					<button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : "Set password"}</button>
				</form>
			</section>
		</main>
	);
}
