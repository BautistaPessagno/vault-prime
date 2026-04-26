"use client";

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

type FloatingFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  rightSlot?: ReactNode;
};

const FloatingField = forwardRef<HTMLInputElement, FloatingFieldProps>(
  function FloatingField(
    { label, hint, error, rightSlot, className, id, ...inputProps },
    ref,
  ) {
    const autoId = useId();
    const inputId = id ?? autoId;
    const hasError = Boolean(error);

    const borderColor = hasError
      ? "border-red-400 focus-within:border-red-400"
      : "border-[color:var(--border)] focus-within:border-[color:var(--accent)]";

    return (
      <div className="space-y-1">
        <fieldset
          className={`relative rounded-xl border bg-transparent transition ${borderColor}`}
        >
          <legend className="ml-3 px-1.5 text-xs font-medium text-[color:var(--muted-foreground)]">
            <label htmlFor={inputId} className="cursor-text">
              {label}
            </label>
          </legend>
          <div className="flex items-center gap-2 px-3 pb-2.5 pt-0">
            <input
              ref={ref}
              id={inputId}
              className={`flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-[color:var(--muted-foreground)]/60 ${className ?? ""}`}
              {...inputProps}
            />
            {rightSlot ? (
              <div className="flex shrink-0 items-center gap-1">{rightSlot}</div>
            ) : null}
          </div>
        </fieldset>
        {hasError ? (
          <p className="px-1 text-xs text-red-400">{error}</p>
        ) : hint ? (
          <p className="px-1 text-xs text-[color:var(--muted-foreground)]">{hint}</p>
        ) : null}
      </div>
    );
  },
);

export default FloatingField;
