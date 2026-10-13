"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";

/**
 * Panel sliding in from the right over the current page, used by the
 * intercepted routes in app/admin/(panel)/@drawer (e.g. "Add vehicle" opened
 * from the stock list). Closing goes back to the page underneath; opening the
 * same URL directly shows the normal full page instead.
 *
 * Navigating elsewhere (e.g. the redirect after saving) leaves the slot's old
 * content in place, so the drawer hides itself once the URL is no longer the
 * one it was opened at.
 */
export default function Drawer(props: DrawerProps) {
  const pathname = usePathname();
  const [openedAt] = useState(pathname);
  return pathname === openedAt ? <DrawerPanel {...props} /> : null;
}

type DrawerProps = {
  title: string;
  description?: React.ReactNode;
  /** Buttons shown beside the title (e.g. Delete). */
  actions?: React.ReactNode;
  children: React.ReactNode;
};

function DrawerPanel({
  title,
  description,
  actions,
  children,
}: DrawerProps) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector('[role="dialog"][aria-modal="true"]:not([data-drawer])')) router.back();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [router]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="drawer-backdrop absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => router.back()} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-drawer
        className="drawer-panel relative flex h-full w-full flex-col bg-slate-100 shadow-2xl sm:max-w-xl lg:w-1/2 lg:max-w-none lg:min-w-[640px]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-surface px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
        </header>
        <div className="drawer-body flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
      </aside>
    </div>
  );
}
