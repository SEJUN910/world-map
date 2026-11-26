"use client";
import type { ReactNode, SelectHTMLAttributes } from "react";

// A chip that shows only the chosen value ("최신순 ▾") and opens the native picker.
// The real <select> lies invisibly over the chip, so the chip is as wide as its
// text (a bare select is as wide as its longest option) and phones keep their own picker.
export function SelectChip({ display, active = false, children, ...select }: { display: ReactNode; active?: boolean; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return <label className={`select-chip${active ? " is-active" : ""}`}>
    <span aria-hidden="true">{display}</span>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    <select {...select}>{children}</select>
  </label>;
}
