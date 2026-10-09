import { Link } from "react-router";
import { Logo } from "./Logo";

export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="border-b border-rule bg-surface">
      <div className="mx-auto flex min-h-15 max-w-[1040px] flex-wrap items-center gap-3 px-4 py-2 md:px-8">
        <Link to="/" className="no-underline" aria-label="Is the market cooked? Home">
          <Logo />
        </Link>
        <div className="ml-auto">
          {children ?? (
            <Link
              to="/about-data"
              className="flex min-h-10 items-center rounded-full border border-rule bg-surface-2 px-4 text-sm"
            >
              About the data
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto max-w-[1040px] px-4 pt-7 pb-12 text-[13px] text-ink-3 md:px-8">
      <p>
        Source: Office for National Statistics, Labour demand volumes by Standard Occupation Classification (SOC
        2020), UK. Official statistics in development. Contains public sector information licensed under the Open
        Government Licence v3.0.
      </p>
      <p className="mt-1.5">Trend words and averages are our reading of the ONS figures, not an ONS measure.</p>
    </footer>
  );
}
