"use client";

import { useRef } from "react";

/** Six visual cells driven by ONE real input: paste, autofill (one-time-code) and
 *  backspace all work natively. */
export default function OtpInput({
  value,
  onChange,
  disabled,
  invalid,
  length = 6,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  length?: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={`otp ${invalid ? "otp-invalid" : ""}`} onClick={() => ref.current?.focus()}>
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          className={`otp-cell ${i === value.length ? "otp-active" : ""} ${value[i] ? "otp-filled" : ""}`}
        >
          {value[i] ?? ""}
        </div>
      ))}
      <input
        ref={ref}
        className="otp-real"
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label="Código de verificação"
        maxLength={length}
        disabled={disabled}
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, length))}
      />
    </div>
  );
}
