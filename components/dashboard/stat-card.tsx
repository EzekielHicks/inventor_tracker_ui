import type { ReactNode } from "react";
import Icon from "@/components/ui/icon";

type StatCardProps = {
	title: string;
	value: string;
	tone: "purple" | "green" | "amber" | "blue";
	icon: ReactNode;
	trend?: {
		value: string;
		direction: "up" | "down";
	};
	detail: string;
};

export default function StatCard({ title, value, tone, icon, trend, detail }: StatCardProps) {
	return (
		<article className="stat-card">
			<div className="stat-top"><span>{title}</span><span className={`stat-icon ${tone}`}>{icon}</span></div>
			<div className="stat-number">{value}</div>
			<div className="stat-foot">
				{trend && <span className={`trend ${trend.direction}`}>{trend.direction === "up" && <Icon name="arrow" size={13} />} {trend.value}</span>}
				<span>{detail}</span>
			</div>
			<div className={`sparkline ${tone}-line`}>{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>
		</article>
	);
}
