# AirCare Frontend

This repository contains the two frontend apps for AirCare:

- customer-feedback/
- employee-dashboard/

Deploy each app to Vercel as a separate project by selecting the corresponding root directory.
Set AIRCARE_API_BASE to the Render backend URL for both projects.

## Vercel setup checklist

Create 2 Vercel projects from this same repo:

- Project 1 root: `customer-feedback/`
- Project 2 root: `employee-dashboard/`

For both projects:

- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `AIRCARE_API_BASE=https://<your-render-api-domain>`

The runtime value is injected into generated `dist/config.js` during build.
