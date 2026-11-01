import type { ReactNode } from "react";
import SectionLayout from "@/components/templates/section-layout";

export default function InventoryLayout({ children }: { children: ReactNode }) {
	return <SectionLayout section="inventory">{children}</SectionLayout>;
}
