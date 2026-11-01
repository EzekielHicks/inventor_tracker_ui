import type { ReactNode } from "react";

export default function SectionLayout({ section, children }: { section: string; children: ReactNode }) {
	return <div className={`section-layout section-${section}`}>{children}</div>;
}
