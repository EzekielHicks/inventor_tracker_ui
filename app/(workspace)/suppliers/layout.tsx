import type { ReactNode } from "react";
import SectionLayout from "@/components/templates/section-layout";

export default function SuppliersLayout({ children }: { children: ReactNode }) {
	return <SectionLayout section="suppliers">{children}</SectionLayout>;
}
