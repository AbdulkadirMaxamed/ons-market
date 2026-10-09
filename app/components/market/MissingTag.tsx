import type { Missing } from "~/lib/missing";
import { InfoTip } from "../InfoTip";

const ICON: Record<Missing["kind"], string> = { not_collected: "⊘", withheld: "⊘", unpublished: "◷", not_found: "?" };

/** Label for a missing figure (collage 8A). `info` adds the ⓘ popover; `written` prints the reason underneath (9C). */
export function MissingTag({
  missing,
  info = false,
  written = false,
  align,
}: {
  missing: Missing;
  info?: boolean;
  written?: boolean;
  align?: "left" | "right";
}) {
  return (
    <span className={written ? "grid gap-1" : "inline-flex items-center gap-1"}>
      <span className="inline-flex items-center gap-1">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-missing bg-surface-2 px-2.5 py-0.5 text-[13px] font-medium whitespace-nowrap text-ink-2">
          <span aria-hidden="true">{ICON[missing.kind]}</span>
          {missing.label}
        </span>
        {info && (
          <InfoTip label={`Why: ${missing.label}`} align={align}>
            <b className="font-semibold">{missing.label}.</b> {missing.reason}
            {missing.source && <span className="mt-1.5 block text-[11.5px] opacity-75">Source: {missing.source}</span>}
          </InfoTip>
        )}
      </span>
      {written && <span className="text-[12.5px] leading-snug text-ink-3">{missing.reason}</span>}
    </span>
  );
}

/** "Partly estimated" tag for the numbers table (collage 11D). */
export function EstimatedTag({ reason, source }: { reason: string; source: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="rounded-full border border-est-rule bg-est-bg px-2.5 py-0.5 text-[12.5px] font-medium whitespace-nowrap text-est">
        Partly estimated
      </span>
      <InfoTip label="Why: partly estimated by ONS">
        <b className="font-semibold">Partly estimated by ONS.</b> {reason}
        <span className="mt-1.5 block text-[11.5px] opacity-75">Source: {source}</span>
      </InfoTip>
    </span>
  );
}
