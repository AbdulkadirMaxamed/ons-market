import { useId, useState } from "react";

type Props<T> = {
  label: string;
  name: string;
  placeholder: string;
  value: string;
  onChange: (text: string) => void;
  options: T[];
  optionKey: (o: T) => string;
  renderOption: (o: T) => React.ReactNode;
  onPick: (o: T) => void;
  onFocus?: () => void;
  error?: boolean;
  describedBy?: string;
  inputRef?: React.Ref<HTMLInputElement>;
};

/**
 * Text box with a suggestion list (ARIA 1.2 combobox pattern). Up/Down move through suggestions, Enter picks one,
 * Escape closes the list. With no pick, Enter submits the form as typed.
 */
export function Combobox<T>({
  label,
  name,
  placeholder,
  value,
  onChange,
  options,
  optionKey,
  renderOption,
  onPick,
  onFocus,
  error,
  describedBy,
  inputRef,
}: Props<T>) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const shown = open && options.length > 0;

  const pick = (o: T) => {
    onPick(o);
    setOpen(false);
    setActive(-1);
  };

  return (
    <div className="relative grid min-w-0 gap-1.5">
      <label htmlFor={id} className="text-[15px] font-medium">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        role="combobox"
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={shown && active >= 0 ? `${id}-${active}` : undefined}
        aria-invalid={error || undefined}
        aria-describedby={describedBy}
        onFocus={() => {
          onFocus?.();
          if (value) setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(options.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter" && shown && active >= 0) {
            e.preventDefault();
            pick(options[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
            setActive(-1);
          }
        }}
        className={`min-h-[54px] w-full rounded-card border bg-surface px-4 text-[17px] font-normal text-ink focus:border-ink focus:shadow-[0_0_0_3px_var(--flat-bg)] focus:outline-none ${
          error ? "border-down" : "border-rule"
        }`}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label={`${label} suggestions`}
        hidden={!shown}
        // Keep focus in the input while clicking a suggestion.
        onMouseDown={(e) => e.preventDefault()}
        className="absolute top-full right-0 left-0 z-20 mt-1 max-h-[320px] overflow-auto rounded-card border border-rule bg-surface p-1 shadow-[0_14px_30px_-14px_rgb(0_0_0/0.35)]"
      >
        {options.map((o, i) => (
          <li
            key={optionKey(o)}
            id={`${id}-${i}`}
            role="option"
            aria-selected={i === active}
            onClick={() => pick(o)}
            onMouseEnter={() => setActive(i)}
            className="cursor-pointer rounded-lg px-3 py-2.5 text-[15px] aria-selected:bg-surface-2"
          >
            {renderOption(o)}
          </li>
        ))}
      </ul>
    </div>
  );
}
