import type { Metadata } from "next";
import Link from "next/link";
import { Clock } from "lucide-react";
import AuthShell from "@/components/admin/AuthShell";

export const metadata: Metadata = { title: "Waiting for approval" };

// Shown after signing up, and whenever a not-yet-approved account signs in.
export default function PendingApproval() {
  return (
    <AuthShell>
      <div className="text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <Clock className="size-7" />
        </span>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Waiting for approval</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Your account has been created and is waiting for a manager to approve it. You will be able to sign in once
          it is approved.
        </p>
        <div className="mt-8 flex flex-col gap-2">
          <Link href="/login" className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Back to sign in
          </Link>
          <Link href="/" className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Go to the website
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
