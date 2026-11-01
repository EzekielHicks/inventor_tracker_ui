"use client";

type StockOverviewCardProps = {
	notify: (message: string) => void;
};

export default function StockOverviewCard({ notify }: StockOverviewCardProps) {
	return (
		<section className="panel stock-panel">
			<div className="panel-heading"><div><h2>Stock overview</h2><p>Inventory movement over time</p></div><button className="select-button" onClick={() => notify("Showing the last 30 days")}>Last 30 days <span>⌄</span></button></div>
			<div className="chart-legend"><span><i className="legend-dot violet-dot"/>Stock in</span><span><i className="legend-dot peach-dot"/>Stock out</span></div>
			<div className="chart-wrap">
				<div className="y-labels"><span>1,000</span><span>750</span><span>500</span><span>250</span><span>0</span></div>
				<div className="chart">
					<div className="chart-grid"><i/><i/><i/><i/><i/></div>
					<svg className="chart-svg" viewBox="0 0 700 180" preserveAspectRatio="none" role="img" aria-label="Stock movement chart">
						<defs><linearGradient id="fillViolet" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#8570e8" stopOpacity=".18"/><stop offset="100%" stopColor="#8570e8" stopOpacity="0"/></linearGradient></defs>
						<path d="M0 123 C35 118 48 94 82 100 S125 129 158 103 S197 89 230 96 S272 65 311 76 S354 106 388 79 S425 55 465 66 S507 78 541 48 S583 61 620 43 S666 33 700 18 L700 180 L0 180Z" fill="url(#fillViolet)"/>
						<path d="M0 123 C35 118 48 94 82 100 S125 129 158 103 S197 89 230 96 S272 65 311 76 S354 106 388 79 S425 55 465 66 S507 78 541 48 S583 61 620 43 S666 33 700 18" fill="none" stroke="#806be1" strokeWidth="3" vectorEffect="non-scaling-stroke"/>
						<path d="M0 150 C39 143 53 154 82 136 S126 143 158 137 S198 150 230 126 S275 130 311 119 S355 138 388 121 S426 115 465 125 S510 108 541 112 S582 120 620 99 S671 110 700 91" fill="none" stroke="#e9a98c" strokeWidth="2.5" strokeDasharray="5 5" vectorEffect="non-scaling-stroke"/>
					</svg>
					<div className="x-labels"><span>Sep 22</span><span>Sep 27</span><span>Oct 02</span><span>Oct 07</span><span>Oct 12</span><span>Oct 17</span><span>Oct 21</span></div>
				</div>
			</div>
		</section>
	);
}
