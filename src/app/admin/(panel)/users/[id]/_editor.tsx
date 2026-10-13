import { notFound, redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2";
import { Trash2 } from "lucide-react";
import EditorFrame from "@/components/admin/EditorFrame";
import UserForm from "@/components/admin/UserForm";
import { ConfirmButton } from "@/components/admin/forms";
import { deleteUser, saveUser } from "@/actions/admin/users";
import { can, managesOnlyTeam, requireUser } from "@/lib/admin/auth";
import { staffOptions } from "@/lib/admin/lookups";
import { rolesAssignableBy } from "@/lib/admin/roles";
import { db } from "@/lib/db";

/** Edit-user form, as a page or in the drawer. */
export default async function UserEditor({ id, inDrawer }: { id: number; inDrawer?: boolean }) {
  const me = await requireUser(["users.manage", "users.manage_team"]);
  const [[[u]], roles, staff] = await Promise.all([
    db.query<RowDataPacket[]>(
      "SELECT u.*, r.is_super FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?",
      [id],
    ),
    rolesAssignableBy(me),
    staffOptions(),
  ]);
  if (!u) notFound();
  if (u.is_super === 1 && !me.isSuper) redirect("/admin/no-access");
  const teamOnly = managesOnlyTeam(me);
  if (teamOnly && u.manager_id !== me.id) redirect("/admin/no-access");
  const isSelf = u.id === me.id;
  return (
    <EditorFrame
      inDrawer={inDrawer}
      title={u.name}
      description={u.email}
      back={{ href: "/admin/users", label: "Users" }}
      actions={
        !isSelf && (
          <ConfirmButton
            action={deleteUser.bind(null, u.id)}
            title={`Delete ${u.name}?`}
            description="They lose access immediately. Customers assigned to them become unassigned."
            size="md"
          >
            <Trash2 className="size-4" /> Delete
          </ConfirmButton>
        )
      }
    >
      <UserForm
        action={saveUser.bind(null, u.id)}
        roles={roles}
        managers={staff.filter((s) => s.id !== u.id)}
        isNew={false}
        isSelf={isSelf}
        teamOnly={teamOnly}
        commission={
          can(me, "commission.manage")
            ? { type: u.commission_type ?? "", value: u.commission_value === null ? "" : String(Number(u.commission_value)) }
            : undefined
        }
        values={{
          name: u.name,
          email: u.email,
          role_id: u.role_id ? String(u.role_id) : "",
          manager_id: u.manager_id ? String(u.manager_id) : "",
          is_active: u.is_active === 1,
        }}
      />
    </EditorFrame>
  );
}
