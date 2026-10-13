import type { RowDataPacket } from "mysql2";
import { Mail, Phone, UserCheck } from "lucide-react";
import ApproveForm from "@/components/admin/ApproveForm";
import { ConfirmButton } from "@/components/admin/forms";
import { Card, EmptyState, PageHeader, Tabs } from "@/components/admin/ui";
import { approveRegistration, deleteRegistration, rejectRegistration } from "@/actions/admin/approvals";
import { requireUser } from "@/lib/admin/auth";
import { dateTime } from "@/lib/admin/format";
import { rolesAssignableBy } from "@/lib/admin/roles";
import { db } from "@/lib/db";

export const metadata = { title: "Approvals" };

export default async function Approvals({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const me = await requireUser("users.approve");
  const { tab = "pending" } = await searchParams;
  const status = tab === "rejected" ? "rejected" : "pending";
  const [[rows], [counts], roles] = await Promise.all([
    db.query<RowDataPacket[]>(
      "SELECT id, name, email, phone, created_at FROM users WHERE approval_status = ? ORDER BY created_at ASC",
      [status],
    ),
    db.query<RowDataPacket[]>(
      "SELECT approval_status, COUNT(*) AS n FROM users WHERE approval_status <> 'approved' GROUP BY approval_status",
    ),
    rolesAssignableBy(me),
  ]);
  const count = (s: string) => Number(counts.find((c) => c.approval_status === s)?.n ?? 0);
  const agent = roles.find((r) => r.name === "Agent");

  return (
    <>
      <PageHeader
        title="Approvals"
        description="People who signed up at /admin/register. They cannot sign in until you approve them and choose a role."
      />
      <Tabs
        active={status}
        tabs={[
          { key: "pending", label: "Waiting", href: "/admin/approvals", count: count("pending") },
          { key: "rejected", label: "Rejected", href: "/admin/approvals?tab=rejected", count: count("rejected") },
        ]}
      />
      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon={UserCheck}
            title={status === "pending" ? "No one is waiting" : "No rejected sign-ups"}
            description={status === "pending" ? "New sign-ups will appear here for approval." : undefined}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((u) => (
              <li key={u.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-sm font-semibold text-amber-700">
                    {String(u.name).split(/\s+/).map((p: string) => p[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{u.name}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                      <a href={`mailto:${u.email}`} className="inline-flex items-center gap-1.5 hover:text-brand-700">
                        <Mail className="size-3.5 text-slate-400" /> {u.email}
                      </a>
                      {u.phone && (
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="size-3.5 text-slate-400" /> {u.phone}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">Signed up {dateTime(u.created_at)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <ApproveForm action={approveRegistration.bind(null, u.id)} roles={roles} defaultRoleId={agent?.id} />
                  {status === "pending" ? (
                    <ConfirmButton
                      action={rejectRegistration.bind(null, u.id)}
                      title={`Reject ${u.name}?`}
                      description="They will not be able to sign in. You can still approve them later from the Rejected tab."
                      confirmLabel="Reject"
                      size="md"
                    >
                      Reject
                    </ConfirmButton>
                  ) : (
                    <ConfirmButton
                      action={deleteRegistration.bind(null, u.id)}
                      title={`Delete ${u.name}'s sign-up?`}
                      description="The account is removed completely and they could register again."
                      size="md"
                    >
                      Delete
                    </ConfirmButton>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
