# Marketplace Dashboard

React dashboard built with TanStack Start, deployed on Vercel. Marketplace API calls run on the server so credentials stay out of the browser bundle.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Deploy to Vercel

1. Push this repository to GitHub, then import it in Vercel. The included `vercel.json` identifies it as a TanStack Start app; Vercel uses Nitro's Vercel preset for the server build.
2. In **Project Settings → Environment Variables**, add the server-side values described below. Do not prefix secrets with `VITE_`.
3. Deploy. After the first deployment, verify login and open a dashboard route directly to confirm server rendering and server functions work.
4. Add a custom domain in **Project Settings → Domains** if desired.

Vercel creates deployments from connected Git pushes. Set variables separately for Preview and Production as appropriate, then redeploy after changing them. Never commit actual credentials or put them in client-side variables.

## Flipkart Seller API

The dashboard reads orders directly from the Flipkart Seller API and refreshes every minute. Set `FLIPKART_APP_ID` and `FLIPKART_APP_SECRET` from your approved Seller API application in the server `.env`. For a self-access seller app the connector uses the `client_credentials` flow; if Flipkart issued your app a refresh token, also set `FLIPKART_REFRESH_TOKEN` and the connector uses that grant. Keep these values out of `VITE_*` variables and never commit real credentials. `FLIPKART_API_ENDPOINT` defaults to `https://api.flipkart.net/sellers/v2/orders/search` (use the matching sandbox API host only when you intentionally want sandbox data).

The dashboard calls Flipkart's `/sellers/v2/orders/search` order-items endpoint and displays order/item IDs, seller SKU, title when included by Flipkart, status, quantity, customer price, order date, shipment ID, and dispatch deadline. Dashboard data refreshes every 60 seconds. The table intentionally does not show buyer address or contact fields. The Flipkart connector is server-only; credentials never enter the browser bundle. The order JSON example describes the fields shown, but the API app ID/secret and (when applicable) refresh token must be entered as environment variables before live data can load.

Brand filters use `CLASPO` and `MONKEYMAN`. Existing `CP`/`MM` sheet values are normalized to those names. Flipkart items map to CLASPO when the SKU is `CL-VB-05-2026` (or the item title/SKU contains `CLASPO`); items whose title/SKU contains `MONKEYMAN` map to MONKEYMAN. `CL-VB-05-2026` and vacuum-bag titles also map to the `VACCUME-BAG` dashboard product filter. Other SKUs remain `Unassigned` until a product-specific mapping is added.

## Amazon Selling Partner API

Amazon India orders use the production Orders API. Configure Claspo with `AMAZON_SP_API_*` and Monkeyman with `AMAZON_SP_API_MONKEYMAN_*` in the untracked server `.env` or deployment secrets, then restart the server. Each account needs its own LWA client ID, client secret, refresh token, AWS access key ID, and AWS secret access key; optional session token, endpoint, region, and marketplace settings are also supported. Do not put credentials in source files, `.env.example`, or `VITE_*` variables. Both accounts default to `https://sellingpartnerapi-eu.amazon.com`, AWS region `eu-west-1`, and marketplace ID `A21TJRUUN4KGV`. Amazon orders are fetched server-side using the same LWA, SigV4, and Orders API flow. The seller account assigns the dashboard brand, and the existing brand filter separates the two feeds.

## Daily synced orders and database dashboard

The `/synced-orders` page and dashboard order metrics read saved marketplace order items from the configured database. Dashboard totals, charts, completed orders and product lists use retained database records only, with brand, marketplace, date and product filters. There is no live marketplace fallback for dashboard orders. Previous-period comparisons outside the retained 30-day window show N/A. The Vercel Cron Job calls `/api/cron/sync-orders` daily at 03:30 UTC (09:00 India time); each run re-fetches the last 30 days for Amazon and Flipkart, upserts the records, then deletes records whose order date is more than 30 days old. The first run also backfills up to 30 days. The existing marketplace connectors have pagination limits, so exceptionally high-volume date ranges should be checked against each connector's page cap.

Connect a PostgreSQL provider such as Neon to the Vercel project and set its connection string as `DATABASE_URL` (the app also recognizes `POSTGRES_URL` and `NEON_DATABASE_URL`). For local phpMyAdmin/MariaDB, create a database such as `ecommerce360_orders`, then set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` in `.env`; these settings take precedence over the embedded local database. MariaDB tables are created automatically on first use. Set `CRON_SECRET` to a long random secret in Vercel's Production environment variables. The endpoint rejects calls without the matching `Authorization: Bearer ...` header; Vercel supplies it automatically when `CRON_SECRET` is configured. Redeploy after setting these variables. The daily schedule is defined in `vercel.json` and appears in Vercel under **Settings → Cron Jobs** after deployment.

For local use, without database variables, development creates a persistent embedded PostgreSQL database under `.local-data/synced-orders` (ignored by Git). To use the MariaDB server visible in phpMyAdmin, create `ecommerce360_orders` there and set its connection values in `.env`. Start the app with `npm run dev`, sign in, open **Synced Orders**, and click **Sync now (local)** to test immediately. The sync uses whichever marketplace credentials exist in `.env`; unconfigured seller accounts are skipped. When deploying later, set `DATABASE_URL` to a hosted PostgreSQL database and add `CRON_SECRET` in Vercel. Order records intentionally exclude buyer contact and address details.
