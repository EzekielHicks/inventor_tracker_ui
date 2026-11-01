import type { ReactNode } from "react";
import SectionLayout from "@/components/templates/section-layout";

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
	return <SectionLayout section="analytics">{children}</SectionLayout>;
}
