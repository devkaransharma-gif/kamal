# Testbook Sales Dashboard

A Node.js service that pulls Testbook sales data, normalizes it, and exposes manager-wise, TL-wise, Today, and MTD revenue metrics through a dashboard.

## Architecture

Testbook API → Node.js service → sales normalization → manager/TL aggregation → dashboard

## Project structure

```
kamal/
├── .github/
│   └── workflows/
│       └── sales-sync.yml
├── src/
│   ├── dashboard.html
│   ├── testbookApi.js
│   ├── salesProcessor.js
│   ├── sync.js
│   └── server.js
├── .gitignore
├── package.json
└── README.md
```

## Dashboard

The Node.js server exposes:

- `/` and `/dashboard` — dashboard UI
- `/health` — health check
- `/sales/summary` — Today + MTD + manager + TL summary
- `/sales/manager-wise` — manager-wise revenue
- `/sales/tl-wise` — TL-wise revenue

The dashboard refreshes its data automatically.

## Environment variables

Required for the Testbook API:

- `TESTBOOK_API_URL`
- `TESTBOOK_API_KEY`

Required before exposing the dashboard publicly:

- `DASHBOARD_USER`
- `DASHBOARD_PASSWORD`

Never commit API keys, dashboard passwords, customer data, or raw sales data to this public repository.

## Run locally

```bash
npm install
npm start
```

Then open the local dashboard at `http://localhost:3000`.

## GitHub Actions

The sales sync workflow runs hourly at minute 15 and can also be started manually. GitHub scheduled workflows use UTC by default. Scheduling away from the top of the hour reduces the chance of delays during GitHub's high-load period.

Configure `TESTBOOK_API_URL` and `TESTBOOK_API_KEY` as GitHub Actions secrets.

## Deployment

The app is ready to deploy as a Node.js web service. Do not deploy the live dashboard without setting `DASHBOARD_USER` and `DASHBOARD_PASSWORD`, because the dashboard reads live business data from the Testbook API.
