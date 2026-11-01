import type { ReactNode } from "react";

type PageTemplateProps = {
	title: string;
	description: string;
	eyebrow?: string;
	action?: ReactNode;
	children: ReactNode;
};

export default function PageTemplate({ title, description, eyebrow, action, children }: PageTemplateProps) {
	return (
		<div className="content page-template">
			<header className="page-heading">
				<div>
					{eyebrow && <div className="eyebrow">{eyebrow}</div>}
					<h1>{title}</h1>
					<p>{description}</p>
				</div>
				{action}
			</header>
			{children}
		</div>
	);
}
