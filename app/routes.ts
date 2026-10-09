import { type RouteConfig, index, route } from "@react-router/dev/routes";

// Sitemap: docs/02-design.md §1. The result page (/market/:occupation/:location) arrives with the data export.
export default [index("routes/home.tsx"), route("about-data", "routes/about-data.tsx")] satisfies RouteConfig;
