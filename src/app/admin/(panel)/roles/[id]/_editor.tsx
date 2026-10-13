import { notFound, redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2";
import { Trash2 } from "lucide-react";
import EditorFrame from "@/components/admin/EditorFrame";
import RoleForm from "@/components/admin/RoleForm";
import { ConfirmButton } from "@/components/admin/forms";
import { deleteRole, saveRole } from "@/actions/admin/roles";
import { requireUser } from "@/lib/admin/auth";
import { PERMISSION_GROUPS } from "@/lib/admin/permissions";
import { db } from "@/lib/db";

/** Edit-role form, as a page or in the drawer. */
export default async function RoleEditor({ id, inDrawer }: { id: number; inDrawer?: boolean }) {
  const me = await requireUser("roles.manage");
  const [[[role]], [perms]] = await Promise.all([
    db.query<RowDataPacket[]>("SELECT * FROM roles WHERE id = ?", [id]),
    db.query<RowDataPacket[]>("SELECT permission FROM role_permissions WHERE role_id = ?", [id]),
  ]);
  if (!role) notFound();
  if (role.is_super) redirect("/admin/roles");
  return (
    <EditorFrame
      inDrawer={inDrawer}
      title={role.name}
      back={{ href: "/admin/roles", label: "Roles" }}
      actions={
        <ConfirmButton action={deleteRole.bind(null, role.id)} title={`Delete the ${role.name} role?`} description="Only roles that no user has can be deleted." size="md">
          <Trash2 className="size-4" /> Delete
        </ConfirmButton>
      }
    >
      <RoleForm
        action={saveRole.bind(null, role.id)}
        groups={PERMISSION_GROUPS.map((g) => ({ label: g.label, permissions: [...g.permissions] }))}
        grantable={[...me.permissions]}
        values={{ name: role.name, description: role.description ?? "", permissions: perms.map((p) => String(p.permission)) }}
        submitLabel="Save changes"
      />
    </EditorFrame>
  );
}
