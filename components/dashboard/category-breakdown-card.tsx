"use client";

import { useMemo } from "react";
import type { Product } from "@/components/providers/inventory-provider";
import Icon from "@/components/ui/icon";

const categoryColors = [
	{ color: "#806be1", dotClass: "violet-dot" },
	{ color: "#e9a98c", dotClass: "peach-dot" },
	{ color: "#e9c574", dotClass: "yellow-dot" },
	{ color: "#d6d7df", dotClass: "gray-dot" },
];

type CategoryBreakdownCardProps = {
	products: readonly Product[];
	notify: (message: string) => void;
};

export default function CategoryBreakdownCard({ products, notify }: CategoryBreakdownCardProps) {
	const categoryData = useMemo(() => {
		const unitsByCategory = new Map<string, number>();
		products.forEach((product) => {
			unitsByCategory.set(product.category, (unitsByCategory.get(product.category) ?? 0) + product.stock);
		});

		const totalUnits = Array.from(unitsByCategory.values()).reduce((total, units) => total + units, 0);
		const categories = Array.from(unitsByCategory, ([name, units], index) => ({
			name,
			units,
			percentage: totalUnits === 0 ? 0 : (units / totalUnits) * 100,
			...categoryColors[index % categoryColors.length],
		}));
		const donutGradient = categories.reduce<{ offset: number; stops: string[] }>((result, category) => {
			const end = result.offset + category.percentage;
			return {
				offset: end,
				stops: [...result.stops, `${category.color} ${result.offset}% ${end}%`],
			};
		}, { offset: 0, stops: [] }).stops.join(", ");

		return { totalUnits, categories, donutGradient };
	}, [products]);

	return (
		<section className="panel category-panel">
			<div className="panel-heading"><div><h2>By category</h2><p>Inventory units across categories</p></div><button className="more-button" aria-label="Category options" onClick={() => notify("Category report options")}><Icon name="more" /></button></div>
			<div className="donut-area">
				<div className="donut" style={{ background: categoryData.totalUnits > 0 ? `conic-gradient(${categoryData.donutGradient})` : "#dfe0e7" }}>
					<div className="donut-center"><strong>{categoryData.totalUnits.toLocaleString()}</strong><span>units</span></div>
				</div>
			</div>
			<div className="category-legend">{categoryData.categories.map((category) => <div key={category.name}><span className="cat-name"><i className={`legend-dot ${category.dotClass}`}/>{category.name}</span><strong>{Math.round(category.percentage)}% <small>{category.units.toLocaleString()} units</small></strong></div>)}</div>
		</section>
	);
}
