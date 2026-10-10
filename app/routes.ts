import { type RouteConfig, index, route } from "@react-router/dev/routes";

// Sitemap: docs/02-design.md §1.
export default [
  index("routes/home.tsx"),
  route("market/:occupation/:location", "routes/market.tsx"),
  route("occupation/:occupation", "routes/occupation.tsx"),
  route("location/:location", "routes/location.tsx"),
  route("about-data", "routes/about-data.tsx"),
] satisfies RouteConfig;
