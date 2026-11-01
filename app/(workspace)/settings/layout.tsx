import type { ReactNode } from "react";
import SectionLayout from "@/components/templates/section-layout";

export default function SettingsLayout({ children }: { children: ReactNode }) {
	return <SectionLayout section="settings">{children}</SectionLayout>;
}
