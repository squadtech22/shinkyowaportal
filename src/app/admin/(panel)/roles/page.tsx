import Link from "next/link";
import type { RowDataPacket } from "mysql2";
import { Lock, Plus, ShieldCheck, Users } from "lucide-react";
import { Badge, ButtonLink, Card, PageHeader } from "@/components/admin/ui";
import { requireUser } from "@/lib/admin/auth";
import { ALL_PERMISSIONS, PERMISSION_LIST } from "@/lib/admin/permissions";
import { db } from "@/lib/db";

export const metadata = { title: "Roles & permissions" };

const LABELS: Record<string, string> = Object.fromEntries(PERMISSION_LIST.map((p) => [p.key, p.label]));

export default async function Roles() {
  await requireUser("roles.manage");
  const [[roles], [perms]] = await Promise.all([
    db.query<RowDataPacket[]>(
      `SELECT r.id, r.name, r.description, r.is_super, (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) AS users
       FROM roles r ORDER BY r.is_super DESC, r.name`,
    ),
    db.query<RowDataPacket[]>("SELECT role_id, permission FROM role_permissions"),
  ]);

  return (
    <>
      <PageHeader
        title="Roles & permissions"
        description="A role decides which sections of the admin panel its users can see and use."
        actions={<ButtonLink href="/admin/roles/new" icon={Plus}>Create role</ButtonLink>}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roles.map((r) => {
          const keys = r.is_super ? ALL_PERMISSIONS : perms.filter((p) => p.role_id === r.id).map((p) => String(p.permission));
          const body = (
            <Card className="flex h-full flex-col p-5 transition hover:border-brand-200 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <span className={`flex size-10 items-center justify-center rounded-xl ${r.is_super ? "bg-accent-50 text-accent-600" : "bg-brand-50 text-brand-700"}`}>
                  {r.is_super ? <Lock className="size-5" /> : <ShieldCheck className="size-5" />}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <Users className="size-3.5" /> {r.users} {Number(r.users) === 1 ? "user" : "users"}
                </span>
              </div>
              <p className="mt-4 font-semibold text-slate-900">{r.name}</p>
              <p className="mt-1 text-sm text-slate-500">{r.description || "No description"}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {r.is_super ? (
                  <Badge tone="red">Every permission</Badge>
                ) : keys.length === 0 ? (
                  <Badge>No permissions</Badge>
                ) : (
                  <>
                    {keys.slice(0, 6).map((k) => (
                      <Badge key={k} tone="brand">{LABELS[k] ?? k}</Badge>
                    ))}
                    {keys.length > 6 && <Badge>+{keys.length - 6} more</Badge>}
                  </>
                )}
              </div>
            </Card>
          );
          return r.is_super ? (
            <div key={r.id}>{body}</div>
          ) : (
            <Link key={r.id} href={`/admin/roles/${r.id}`} className="block">
              {body}
            </Link>
          );
        })}
      </div>
    </>
  );
}
