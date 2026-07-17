"use client";

import { useFormStatus } from "react-dom";

export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";

export const labelClass = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";

export function SubmitButton({
  children,
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
}) {
  const { pending } = useFormStatus();
  const base =
    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60";
  const styles = {
    primary: "bg-ink-900 text-white hover:bg-ink-800",
    secondary: "border border-slate-300 text-slate-700 hover:bg-slate-50",
    danger: "bg-brand-600 text-white hover:bg-brand-700",
  }[variant];
  return (
    <button type="submit" disabled={pending} className={`${base} ${styles} ${className}`}>
      {pending ? "Working…" : children}
    </button>
  );
}

export function FormError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
  );
}

export function FormSuccess({ show, message }: { show?: boolean; message: string }) {
  if (!show) return null;
  return (
    <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
      {message}
    </p>
  );
}
