import Link from "next/link";
import Icon from "@/components/ui/icon";

export default function AuthError({ membership = false }: { membership?: boolean }) {
	return (
		<main className="auth-screen">
			<div className="user-picker-brand"><span className="brand-mark"><Icon name="box" size={21} /></span><span>stockroom<span className="brand-dot">.</span></span></div>
			<section className="auth-card">
				<span className="eyebrow">ACCOUNT SETUP</span>
				<h1>{membership ? "Workspace setup incomplete" : "Could not confirm your email"}</h1>
				<p>{membership
					? "Your email was confirmed, but no workspace membership was found. Check that the database migration was applied, then contact the workspace admin."
					: "The confirmation link may have expired or already been used. Request a new email or return to sign in."}</p>
				<Link className="auth-mode-toggle" href="/">Return to sign in</Link>
			</section>
		</main>
	);
}
