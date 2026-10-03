"use client";
import { Printer } from "lucide-react";

export function PrintButton({ label = "Print receipt" }: { label?: string }) {
  return <button type="button" onClick={() => window.print()} className="btn btn-primary"><Printer className="size-4" />{label}</button>;
}
