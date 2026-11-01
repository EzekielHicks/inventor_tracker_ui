import type { ReactNode } from "react";
import SectionLayout from "@/components/templates/section-layout";

export default function OverviewLayout({ children }: { children: ReactNode }) {
	return <SectionLayout section="overview">{children}</SectionLayout>;
}
