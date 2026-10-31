import { type ChangeEvent } from "react";
import { Input } from "@/components/ui/input";

export const AB_SECONDS_DEFAULT = 5;
export const AB_SECONDS_MIN = 2;
export const AB_SECONDS_MAX = 200;

export function clampAbSeconds(value: number): number {
  return Math.min(AB_SECONDS_MAX, Math.max(AB_SECONDS_MIN, value));
}

/** Empty or non-integer text resolves to the default. Other integers clamp into range. */
export function resolveAbSeconds(text: string): number {
  const parsed = Number.parseInt(text, 10);
  if (!Number.isInteger(parsed)) {
    return AB_SECONDS_DEFAULT;
  }
  return clampAbSeconds(parsed);
}

export function AbSecondsField({
  value,
  disabled = false,
  className,
  onValueChange,
}: {
  value: string;
  disabled?: boolean;
  className?: string;
  onValueChange: (text: string) => void;
}) {
  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value;
    if (raw === "") {
      onValueChange("");
      return;
    }
    if (!/^\d{1,3}$/.test(raw)) {
      return;
    }
    onValueChange(raw);
  }

  function onBlur() {
    onValueChange(String(resolveAbSeconds(value)));
  }

  return (
    <Input
      type="text"
      inputMode="numeric"
      min={AB_SECONDS_MIN}
      max={AB_SECONDS_MAX}
      aria-label="Seconds"
      disabled={disabled}
      value={value}
      className={className}
      onChange={onChange}
      onBlur={onBlur}
    />
  );
}
