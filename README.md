This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Environment variables

The app does not currently require environment variables. Copy `.env.example` to `.env.local` when local configuration is needed, and keep secrets in `.env.local` rather than committing them.

## Workspace pages

- `/` is the local profile picker; profiles are stored in the browser.
- `/overview` is the main dashboard.
- `/inventory` manages products and stock orders.
- `/analytics` summarizes stock levels and order statuses.
- `/suppliers` manages suppliers and provides sourcing request history.
- `/settings` configures low-stock thresholds and optional web sourcing templates.

The sidebar collapse preference is stored in the browser. Inventory and order changes are shared while navigating workspace pages, but are currently reset when the page is refreshed.

The Inventory page lets managers and admins add, edit, and remove products. Managers and admins can view Inventory history, including available stock, units on order, optional unit cost and stock value, orders, and recorded usage, and export the history as CSV. Product usage totals, record counts, and most recent use are also summarized in the inventory table; renaming a product carries its usage and order history forward. Products with open sourcing requests or outstanding orders cannot be removed. Team members can view stock, record usage, and submit order requests but cannot change product records or stock directly. Managers and admins can set an optional default low-stock threshold in Settings and override it per product; settings are stored in browser storage.

To scaffold another workspace page, create a route under `app/(workspace)/<route>/` and render its page component from `components/pages/<route>/app.tsx`. Reuse `PageTemplate` for the page heading and shared content layout.

## Supplier sourcing and orders

The Suppliers page is available only to managers and admins. It stores supplier contacts, optional HTTPS search templates, optional API endpoint placeholders, and sourcing requests in browser storage. Website and API connections are optional. Requests can be created without a configured search template; managers can open a configured product search when available and record an order after completing checkout. The Inventory page supports multiple product requests in one submission, with each item routed to its selected supplier. Recording an order creates the corresponding stock-order quantity. Checkout remains a manual action; there is no separate approval stage. API templates do not make network calls or store credentials. These roles are local demo settings—not secure authorization. Connect authenticated accounts and trusted server-side integrations before using this for real inventory or purchasing.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
