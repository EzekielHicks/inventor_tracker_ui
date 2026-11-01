import type { ReactNode } from "react";
import WorkspaceShell from "@/components/layout/workspace-shell";
import { InventoryProvider } from "@/components/providers/inventory-provider";
import { SupplierProvider } from "@/components/providers/supplier-provider";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
	return (
		<SupplierProvider>
			<InventoryProvider>
				<WorkspaceShell>{children}</WorkspaceShell>
			</InventoryProvider>
		</SupplierProvider>
	);
}
