"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useUsers, type UserRole } from "@/components/providers/user-provider";
import Icon from "@/components/ui/icon";

export default function Page() {
	const router = useRouter();
	const { users, addUser, removeUser, selectUser } = useUsers();
	const [addingUser, setAddingUser] = useState(false);
	const [removingUserId, setRemovingUserId] = useState<string | null>(null);
	const [removeError, setRemoveError] = useState("");
	const [name, setName] = useState("");
	const [role, setRole] = useState<UserRole>("Team Member");

	const enterAsUser = (user: (typeof users)[number]) => {
		selectUser(user.id);
		router.push("/overview");
	};

	const createUser = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const normalizedName = name.trim().replace(/\s+/g, " ");
		if (!normalizedName) return;
		enterAsUser(addUser(normalizedName, role));
	};

	return (
		<main className="user-picker-screen">
			<div className="user-picker-brand"><span className="brand-mark"><Icon name="box" size={21} /></span><span>stockroom<span className="brand-dot">.</span></span></div>
			<div className="user-picker-content">
				<div className="user-picker-heading"><span className="eyebrow">INVENTORY WORKSPACE</span><h1>{addingUser ? "Add a user" : "Who's using Stockroom?"}</h1><p>{addingUser ? "Create a local profile to personalize this workspace." : "Select a profile to continue to your workspace."}</p></div>
				{addingUser ? (
					<form className="add-user-form" onSubmit={createUser}>
						<label htmlFor="new-user-name">Your name</label>
						<input id="new-user-name" autoFocus autoComplete="name" maxLength={32} placeholder="e.g. Jordan Davis" required value={name} onChange={(event) => setName(event.target.value)} />
						<label htmlFor="new-user-role">Workspace role</label>
						<select id="new-user-role" value={role} onChange={(event) => setRole(event.target.value as UserRole)}><option value="Team Member">Team member</option><option value="Manager">Manager</option><option value="Admin">Admin</option></select>
						<p className="role-demo-note">Roles are local demo settings, not secure account permissions.</p>
						<div className="add-user-actions"><button className="secondary-button" type="button" onClick={() => { setAddingUser(false); setName(""); }}>Back to profiles</button><button className="primary-button" type="submit">Create profile <Icon name="chevron" size={15} /></button></div>
					</form>
				) : (
					<div className="user-picker-grid">
						{users.map((user, index) => (
							<div className="user-picker-option" key={user.id}>
								<button className={`user-avatar ${user.avatarColor}`} aria-label={`Continue as ${user.name}`} onClick={() => enterAsUser(user)}><span>{user.initials}</span><i /></button>
								<span className="user-picker-name">{user.name}</span>
								{index === 0 && <button className="add-user-bubble" aria-label="Add a user" title="Add a user" onClick={() => setAddingUser(true)}><Icon name="plus" size={18} /></button>}
								{removingUserId === user.id ? (
									<div className="remove-user-confirmation">
										<span>Remove {user.name}?</span>
										<div>
											<button type="button" className="remove-user-confirm" onClick={() => {
												try {
													removeUser(user.id);
													setRemovingUserId(null);
													setRemoveError("");
												} catch (error) {
													setRemoveError(error instanceof Error ? error.message : "Could not remove this user.");
												}
											}}>Remove</button>
											<button type="button" className="remove-user-cancel" onClick={() => { setRemovingUserId(null); setRemoveError(""); }}>Cancel</button>
										</div>
									</div>
								) : <button type="button" className="remove-user-button" aria-label={`Remove ${user.name}`} title={users.length === 1 ? "At least one profile must remain" : `Remove ${user.name}`} disabled={users.length === 1} onClick={() => { setRemovingUserId(user.id); setRemoveError(""); }}>Remove</button>}
							</div>
						))}
					</div>
				)}
				{removeError && <p className="remove-user-error" role="alert">{removeError}</p>}
			</div>
			<footer className="user-picker-footer"><span>Stockroom inventory</span><span>Choose a profile to get started</span></footer>
		</main>
	);
}
