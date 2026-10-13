"use client";

import { Printer } from "lucide-react";
import { buttonClass } from "./ui";

export default function PrintButton({ label = "Print / save as PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("primary")}>
      <Printer className="size-4" /> {label}
    </button>
  );
}
