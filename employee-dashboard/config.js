/**
 * Sets the API base URL the dashboard talks to.
 *
 * Left EMPTY on purpose for local Docker use: docker-compose.yml already
 * builds this app behind its own nginx (see web/employee-dashboard/Dockerfile),
 * which reverse-proxies /api/ to the backend container over Docker's
 * internal network. An empty string means "call relative paths," which is
 * exactly correct in that setup -- no URL to configure at all.
 *
 * Only fill this in with a real URL (e.g. https://your-backend.example.com)
 * if this app is ever deployed as a standalone static site on a DIFFERENT
 * origin than its backend (e.g. Vercel/Netlify without the nginx proxy in
 * front of it) -- see docs/EMPLOYEE_DASHBOARD_ANALYSIS.md for why this
 * matters and what breaks silently if it's missed in that scenario.
 */
window.__AIRCARE_API_BASE__ = "";
