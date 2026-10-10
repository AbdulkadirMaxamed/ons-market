import { useEffect, useId, useRef, useState } from "react";

/**
 * ⓘ button that opens a small explanation (collage 9C). Opens on tap or click, on hover with a mouse, and with the
 * keyboard; closes on Escape, on a tap elsewhere, or when focus leaves.
 */
export function InfoTip({
  label,
  children,
  align = "right",
}: {
  label: string;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  const [hover, setHover] = useState(false); // mouse over it
  const [pinned, setPinned] = useState(false); // opened by tap, click or keyboard
  const open = hover || pinned;
  const close = () => (setHover(false), setPinned(false));
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <span
      ref={ref}
      className="relative inline-flex align-middle"
      onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHover(false)}
      onBlur={(e) => !ref.current?.contains(e.relatedTarget as Node) && close()}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => (pinned ? close() : setPinned(true))}
        className="grid size-6 cursor-help place-items-center rounded-full text-ink-3 hover:text-ink"
      >
        <span
          aria-hidden="true"
          className="grid size-[18px] place-items-center rounded-full border-[1.5px] border-current text-[11px] leading-none font-semibold"
        >
          i
        </span>
      </button>
      <span
        id={id}
        role="note"
        hidden={!open}
        className={`absolute top-full z-30 mt-1.5 w-[min(280px,78vw)] rounded-lg bg-callout px-3.5 py-3 text-left text-[13px] leading-[1.45] font-light whitespace-normal text-callout-ink shadow-[0_12px_28px_-10px_rgb(0_0_0/0.5)] ${
          align === "right" ? "right-0" : "left-0"
        }`}
      >
        {children}
      </span>
    </span>
  );
}
