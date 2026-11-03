import { connection } from "next/server";
import { getWorkspaceAccess } from "@/lib/supabase/access";

const DATA_KEYS = new Set(["inventory", "suppliers", "settings"]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canTeamMemberUpdateInventory(current: unknown, next: unknown, userId: string, displayName: string) {
	if (!isRecord(current) || !isRecord(next) || !Array.isArray(current.products) || !Array.isArray(next.products)
		|| !Array.isArray(current.orders) || !Array.isArray(next.orders)
		|| !Array.isArray(current.usageRecords) || !Array.isArray(next.usageRecords)) return false;
	if (JSON.stringify(current.orders) !== JSON.stringify(next.orders)
		|| next.products.length !== current.products.length
		|| next.usageRecords.length <= current.usageRecords.length) return false;

	const products = new Map<string, number>();
	for (const product of current.products) {
		if (!isRecord(product) || typeof product.name !== "string" || typeof product.stock !== "number") return false;
		products.set(product.name, product.stock);
	}
	const changes = new Map<string, number>();
	for (const product of next.products) {
		if (!isRecord(product) || typeof product.name !== "string" || typeof product.stock !== "number") return false;
		const previous = current.products.find((item) => isRecord(item) && item.name === product.name);
		if (!isRecord(previous)) return false;
		const previousDetails = Object.fromEntries(Object.entries(previous).filter(([key]) => key !== "stock" && key !== "status"));
		const nextDetails = Object.fromEntries(Object.entries(product).filter(([key]) => key !== "stock" && key !== "status"));
		if (typeof previous.stock !== "number") return false;
		const stock = previous.stock;
		const nextStock = product.stock;
		const nextStatus = product.status;
		if (JSON.stringify(previousDetails) !== JSON.stringify(nextDetails) || !Number.isSafeInteger(stock) || stock < 0
			|| !Number.isSafeInteger(nextStock) || nextStock < 0 || nextStock > stock) return false;
		if (!["In stock", "Low stock", "Out of stock"].includes(String(nextStatus))) return false;
		if (nextStock !== stock) changes.set(product.name, stock - nextStock);
	}
	const addedRecordCount = next.usageRecords.length - current.usageRecords.length;
	const addedRecords = next.usageRecords.slice(0, addedRecordCount);
	if (JSON.stringify(next.usageRecords.slice(addedRecordCount)) !== JSON.stringify(current.usageRecords)) return false;
	const usage = new Map<string, number>();
	for (const record of addedRecords) {
		if (!isRecord(record) || record.recordedBy !== displayName || record.recordedById !== userId || typeof record.id !== "string"
			|| typeof record.recordedAt !== "string" || !Array.isArray(record.items)) return false;
		for (const item of record.items) {
			if (!isRecord(item) || typeof item.productName !== "string" || !Number.isSafeInteger(item.quantity) || Number(item.quantity) <= 0) return false;
			usage.set(item.productName, (usage.get(item.productName) ?? 0) + Number(item.quantity));
		}
	}
	if (usage.size !== changes.size) return false;
	return Array.from(changes).every(([name, amount]) => usage.get(name) === amount && products.has(name))
		&& Array.from(usage.keys()).every((name) => changes.has(name))
		&& Object.keys(next).every((key) => Object.hasOwn(current, key))
		&& Object.keys(current).every((key) => Object.hasOwn(next, key));
}

function canTeamMemberAppendRequests(current: unknown, next: unknown, inventory: unknown, userId: string, displayName: string) {
	if (!isRecord(current) || !isRecord(next) || !Array.isArray(current.requests) || !Array.isArray(next.requests)
		|| next.requests.length <= current.requests.length) return false;
	const suppliers = current.suppliers;
	const sites = current.sites;
	if (!Array.isArray(suppliers) || !Array.isArray(sites)) return false;
	if (Object.keys(current).length !== Object.keys(next).length
		|| Object.keys(current).some((key) => !Object.hasOwn(next, key))
		|| JSON.stringify(suppliers) !== JSON.stringify(next.suppliers)
		|| JSON.stringify(sites) !== JSON.stringify(next.sites)) return false;
	if (!isRecord(inventory) || !Array.isArray(inventory.products)) return false;
	const products = inventory.products;
	const addedRequestCount = next.requests.length - current.requests.length;
	if (JSON.stringify(next.requests.slice(addedRequestCount)) !== JSON.stringify(current.requests)) return false;
	const seenIds = new Set(current.requests.filter(isRecord).map((request) => request.id));
	return next.requests.slice(0, addedRequestCount).every((request) => {
		if (!isRecord(request) || request.requesterId !== userId || request.requesterName !== displayName
			|| !Number.isSafeInteger(request.quantity) || Number(request.quantity) <= 0
			|| typeof request.productName !== "string" || typeof request.id !== "string"
			|| request.status !== "Pending review" || typeof request.createdAt !== "string"
			|| typeof request.supplierId !== "string" || seenIds.has(request.id)) return false;
		seenIds.add(request.id);
		const supplier = suppliers.find((item: unknown) => isRecord(item) && item.id === request.supplierId);
		const site = request.siteId ? sites.find((item: unknown) => isRecord(item) && item.id === request.siteId && item.type === "search") : undefined;
		const productExists = products.some((item: unknown) => isRecord(item) && item.name === request.productName);
		return isRecord(supplier) && typeof supplier.name === "string" && request.supplierName === supplier.name
			&& (request.siteId ? isRecord(site) && request.siteName === site.name : request.siteName === "No web search")
			&& productExists;
	});
}

export async function GET() {
	await connection();
	try {
		const access = await getWorkspaceAccess();
		if (!access || access.mustChangePassword || access.member.role === "pending") {
			return Response.json({ message: "An active workspace account is required." }, { status: 403 });
		}
		const { data, error } = await access.admin.from("workspace_data").select("data_key, data, version");
		if (error) throw error;
		return Response.json({
			data: Object.fromEntries((data ?? [])
				.filter((row) => DATA_KEYS.has(row.data_key))
				.map((row) => [row.data_key, { value: row.data, version: row.version }])),
		});
	} catch (error) {
		console.error("Could not load shared workspace data.", error);
		return Response.json({ message: "Could not load shared workspace data." }, { status: 500 });
	}
}

export async function POST(request: Request) {
	try {
		const access = await getWorkspaceAccess();
		if (!access || access.mustChangePassword || access.member.role === "pending") {
			return Response.json({ message: "An active workspace account is required." }, { status: 403 });
		}
		const body: unknown = await request.json();
		if (!isRecord(body) || typeof body.key !== "string" || !DATA_KEYS.has(body.key)
			|| !("value" in body) || !(body.expectedVersion === null || Number.isSafeInteger(body.expectedVersion))) {
			return Response.json({ message: "Invalid workspace data update." }, { status: 400 });
		}

		const { data: current, error: readError } = await access.admin.from("workspace_data")
			.select("data, version").eq("data_key", body.key).maybeSingle();
		if (readError) throw readError;
		if ((current?.version ?? null) !== body.expectedVersion) {
			return Response.json({ message: "Workspace data changed elsewhere. Reload the page and try again." }, { status: 409 });
		}

		if (access.member.role === "team_member") {
			let allowed = body.key === "inventory"
				? canTeamMemberUpdateInventory(current?.data, body.value, access.user.id, access.member.display_name)
				: false;
			if (body.key === "suppliers") {
				const { data: inventoryRow, error: inventoryError } = await access.admin.from("workspace_data")
					.select("data").eq("data_key", "inventory").maybeSingle();
				if (inventoryError) throw inventoryError;
				allowed = canTeamMemberAppendRequests(current?.data, body.value, inventoryRow?.data, access.user.id, access.member.display_name);
			}
			if (!allowed) return Response.json({ message: "Your workspace role cannot make this change." }, { status: 403 });
		}
		if (access.member.role !== "admin" && access.member.role !== "manager" && access.member.role !== "team_member") {
			return Response.json({ message: "Your workspace account is not active." }, { status: 403 });
		}

		const query = current
			? access.admin.from("workspace_data").update({ data: body.value, version: current.version + 1, updated_at: new Date().toISOString() })
				.eq("data_key", body.key).eq("version", current.version).select("version").maybeSingle()
			: access.admin.from("workspace_data").insert({ data_key: body.key, data: body.value, version: 1 }).select("version").maybeSingle();
		const { data, error } = await query;
		if (error) {
			if (error.code === "23505") return Response.json({ message: "Workspace data changed elsewhere. Reload the page and try again." }, { status: 409 });
			throw error;
		}
		if (!data) return Response.json({ message: "Workspace data changed elsewhere. Reload the page and try again." }, { status: 409 });
		return Response.json({ version: data.version });
	} catch (error) {
		console.error("Could not save shared workspace data.", error);
		return Response.json({ message: "Could not save shared workspace data." }, { status: 500 });
	}
}
