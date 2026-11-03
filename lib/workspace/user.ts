export type UserProfile = {
	id: string;
	name: string;
	initials: string;
	role: "Admin" | "Manager" | "Team Member" | "Pending";
	avatarColor: string;
	email: string;
};

function initialsFor(name: string) {
	return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase();
}

function roleLabel(role: unknown): UserProfile["role"] {
	if (role === "admin") return "Admin";
	if (role === "manager") return "Manager";
	if (role === "team_member") return "Team Member";
	return "Pending";
}

function avatarFor(id: string) {
	const colors = ["avatar-jordan", "avatar-alex", "avatar-taylor"];
	return colors[[...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length];
}

export function createUserProfile(id: string, name: string, role: unknown, email: string): UserProfile {
	return { id, name, initials: initialsFor(name), role: roleLabel(role), avatarColor: avatarFor(id), email };
}
