import Link from "next/link";
import type { RowDataPacket } from "mysql2";
import { Plus, UserCog } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/admin/ui";
import { managesOnlyTeam, requireUser } from "@/lib/admin/auth";
import { getFormat } from "@/lib/admin/display";
import { dateTime } from "@/lib/admin/format";
import { db } from "@/lib/db";

export const metadata = { title: "Users" };

export default async function Users() {
  const { yen } = await getFormat();
  const me = await requireUser(["users.manage", "users.manage_team"]);
  // Team managers only see (and edit) the people who report to them.
  const teamOnly = managesOnlyTeam(me);
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT u.id, u.name, u.email, u.is_active, u.last_login_at, u.commission_type, u.commission_value, r.name AS role,
            r.is_super, mgr.name AS manager,
            (SELECT COUNT(*) FROM users t WHERE t.manager_id = u.id) AS team,
            (SELECT COUNT(*) FROM customer_accounts c WHERE c.agent_id = u.id) AS customers
     FROM users u LEFT JOIN roles r ON r.id = u.role_id LEFT JOIN users mgr ON mgr.id = u.manager_id
     WHERE u.approval_status = 'approved' ${teamOnly ? "AND u.manager_id = ?" : ""}
     ORDER BY r.is_super DESC, u.name`,
    teamOnly ? [me.id] : [],
  );
  return (
    <>
      <PageHeader
        title={teamOnly ? "My team" : "Users"}
        description={teamOnly ? "Staff who report to you. People you add join your team." : "Staff who can sign in to this admin panel."}
        actions={<ButtonLink href="/admin/users/new" icon={Plus}>Add user</ButtonLink>}
      />
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={UserCog} title={teamOnly ? "No one reports to you yet" : "No users"} description={teamOnly ? "Add your agents with Add user." : undefined} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>User</Th>
                <Th>Role</Th>
                <Th className="md:max-lg:hidden">Reports to</Th>
                <Th className="text-right md:max-lg:hidden">Customers</Th>
                <Th className="md:max-lg:hidden">Commission</Th>
                <Th className="md:max-lg:hidden">Last sign-in</Th>
                <Th>Status</Th>
                <Th className="text-right"><span className="sr-only">Actions</span></Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const editable = me.isSuper || u.is_super !== 1;
                return (
                  <tr key={u.id} className="hover:bg-slate-50/60">
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                          {String(u.name).split(/\s+/).map((p: string) => p[0]).join("").slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <p className="font-medium text-slate-900">
                            {u.name} {u.id === me.id && <span className="text-xs font-normal text-slate-400">(you)</span>}
                          </p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </div>
                      </div>
                    </Td>
                    <Td label="Role">{u.role ? <Badge tone={u.is_super ? "red" : "brand"}>{u.role}</Badge> : <Badge>No role</Badge>}</Td>
                    <Td label="Reports to" className="md:max-lg:hidden text-slate-600">
                      <div>
                        {u.manager ?? <span className="text-slate-400">—</span>}
                        {Number(u.team) > 0 && <p className="text-xs text-slate-500">Leads {u.team} {Number(u.team) === 1 ? "person" : "people"}</p>}
                      </div>
                    </Td>
                    <Td label="Customers" className="md:max-lg:hidden text-right tabular-nums">{u.customers}</Td>
                    <Td label="Commission" className="md:max-lg:hidden text-slate-600">
                      {u.commission_type === "percent"
                        ? `${Number(u.commission_value)}% of profit`
                        : u.commission_type === "fixed"
                          ? `${yen(Number(u.commission_value))} per car`
                          : <span className="text-slate-400">—</span>}
                    </Td>
                    <Td label="Last sign-in" className="md:max-lg:hidden text-slate-500">{u.last_login_at ? dateTime(u.last_login_at) : "Never"}</Td>
                    <Td label="Status">{u.is_active ? <Badge tone="green">Active</Badge> : <Badge>Disabled</Badge>}</Td>
                    <Td actions className="text-right">
                      {editable && (
                        <Link href={`/admin/users/${u.id}`} className="text-sm font-medium text-brand-600 hover:text-brand-800">
                          Edit
                        </Link>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
