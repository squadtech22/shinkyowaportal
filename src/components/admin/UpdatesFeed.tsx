import { Bell, Car, FileText, MessageSquare, Ship, Undo2, Wallet } from "lucide-react";
import { cx } from "./ui";
import { dateTime } from "@/lib/admin/format";
import type { CustomerUpdate, UpdateKind } from "@/lib/admin/updates";

const KINDS: Record<UpdateKind, { icon: typeof Bell; cls: string }> = {
  reserved: { icon: Car, cls: "bg-brand-50 text-brand-700" },
  released: { icon: Undo2, cls: "bg-slate-100 text-slate-600" },
  payment: { icon: Wallet, cls: "bg-emerald-50 text-emerald-700" },
  shipping: { icon: Ship, cls: "bg-sky-50 text-sky-700" },
  documents: { icon: FileText, cls: "bg-amber-50 text-amber-700" },
  note: { icon: MessageSquare, cls: "bg-violet-50 text-violet-700" },
};

/** The customer's Updates feed, newest first: in the portal and on the admin customer page. */
export default function UpdatesFeed({
  updates,
  audience,
}: {
  updates: CustomerUpdate[];
  /** "staff" shows who did each step; "customer" names only the sender of a message. */
  audience: "staff" | "customer";
}) {
  if (!updates.length) {
    return (
      <p className="flex items-center gap-2 p-5 text-sm text-slate-500">
        <Bell className="size-4" />
        {audience === "customer"
          ? "Updates about your vehicles and payments will appear here."
          : "No updates yet. Reservations, payments, shipping and documents are added here automatically."}
      </p>
    );
  }
  return (
    <ol className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto">
      {updates.map((u) => {
        const kind = KINDS[u.kind] ?? KINDS.note;
        const showBy = u.by_name && (audience === "staff" || u.kind === "note");
        return (
          <li key={u.id} className="flex gap-3 px-5 py-3">
            <span className={cx("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full", kind.cls)}>
              <kind.icon className="size-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm text-slate-800">{u.message}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {dateTime(u.created_at)}
                {showBy && ` · ${u.kind === "note" && audience === "customer" ? `from ${u.by_name}` : `by ${u.by_name}`}`}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
