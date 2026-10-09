import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

import type { Route } from "./+types/root";
import { SiteFooter, SiteHeader } from "./components/SiteChrome";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "icon", href: "/favicon.ico", sizes: "32x32" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600&display=swap" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#eef1f4" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0a0d12" media="(prefers-color-scheme: dark)" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let details = "We couldn’t load this page. The data is fine; please try again.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error) && error.status === 404) {
    title = "Page not found";
    details = "We don’t have a page at this address. Try searching for a job and a place instead.";
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1040px] px-4 py-16 md:px-8">
        <h1 className="text-3xl">{title}</h1>
        <p className="mt-3 max-w-[60ch] text-ink-2">{details}</p>
        {stack && (
          <pre className="mt-6 overflow-x-auto rounded-card border border-rule bg-surface p-4 text-sm">
            <code>{stack}</code>
          </pre>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
