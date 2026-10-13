import type { RowDataPacket } from "mysql2";
import AdminShell, { type NavKey, type QuickAction } from "@/components/admin/AdminShell";
import { Toast } from "@/components/admin/forms";
import { can, canAny, customerScope, requireUser } from "@/lib/admin/auth";
import type { Permission } from "@/lib/admin/permissions";
import { db } from "@/lib/db";

// One permission, any of a list, or null for every signed-in user.
const NAV_PERMISSION: Record<NavKey, Permission | Permission[] | null> = {
  dashboard: "dashboard.view",
  mycommission: null,
  commissions: ["commission.manage", "commission.approve", "commission.pay"],
  finance: "finance.view",
  ledger: "finance.view",
  japan: "finance.view",
  stock: "stock.view",
  customers: "customers.view",
  payments: "payments.view",
  reserved: "customers.view",
  inquiries: "inquiries.view",
  shipments: "shipments.view",
  documents: "documents.view",
  website: "website.manage",
  catalog: "catalog.manage",
  approvals: "users.approve",
  users: ["users.manage", "users.manage_team"],
  roles: "roles.manage",
};

// Every page under /admin requires a signed-in user.
// `drawer` is the @drawer slot: "add" forms opened from a list slide in over
// it (see components/admin/Drawer.tsx).
export default async function PanelLayout({ children, drawer }: { children: React.ReactNode; drawer: React.ReactNode }) {
  const user = await requireUser();
  const allowed = (Object.keys(NAV_PERMISSION) as NavKey[]).filter((k) => {
    // Super Admin earns no commission.
    if (k === "mycommission") return !user.isSuper;
    const p = NAV_PERMISSION[k];
    return p === null || canAny(user, Array.isArray(p) ? p : [p]);
  });

  const badges: Partial<Record<NavKey, number>> = {};
  if (allowed.includes("payments")) {
    const scope = customerScope(user);
    const [[row]] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS n FROM payments p JOIN customer_accounts c ON c.id = p.customer_account_id
       WHERE p.status = 'not approved' AND ${scope.sql}`,
      scope.params,
    );
    badges.payments = Number(row.n);
  }
  if (allowed.includes("inquiries")) {
    const [[row]] = await db.query<RowDataPacket[]>(
      `SELECT (SELECT COUNT(*) FROM inquiries WHERE status = 'new')
            + (SELECT COUNT(*) FROM contact_messages WHERE status = 'new') AS n`,
    );
    badges.inquiries = Number(row.n);
  }

  if (allowed.includes("approvals")) {
    const [[row]] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM users WHERE approval_status = 'pending'");
    badges.approvals = Number(row.n);
  }
  // Staff months waiting for this user's step: approval, or payment.
  if (can(user, "commission.approve") || can(user, "commission.pay")) {
    const [[row]] = await db.query<RowDataPacket[]>(
      can(user, "commission.approve")
        ? "SELECT COUNT(DISTINCT user_id, period) AS n FROM commissions WHERE status = 'pending'"
        : "SELECT COUNT(*) AS n FROM commission_payouts WHERE status = 'approved'",
    );
    badges.commissions = Number(row.n);
  }

  const quickActions = (
    [
      ["vehicle", ["stock.manage", "stock.add"]],
      ["customer", "customers.manage"],
      ["payment", "payments.manage"],
      ["shipment", "shipments.manage"],
      ["japanPayment", "finance.manage"],
      ["user", ["users.manage", "users.manage_team"]],
    ] as [QuickAction, Permission | Permission[]][]
  )
    .filter(([, p]) => canAny(user, Array.isArray(p) ? p : [p]))
    .map(([a]) => a);

  return (
    <AdminShell
      user={{ name: user.name, email: user.email, roleName: user.roleName }}
      allowed={allowed}
      badges={badges}
      quickActions={quickActions}
    >
      {children}
      {drawer}
      <Toast />
    </AdminShell>
  );
}
