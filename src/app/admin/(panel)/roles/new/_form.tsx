import RoleForm from "@/components/admin/RoleForm";
import { saveRole } from "@/actions/admin/roles";
import { requireUser } from "@/lib/admin/auth";
import { PERMISSION_GROUPS } from "@/lib/admin/permissions";

/** "Create role" form, shown as a page and in the drawer. */
export default async function NewRoleForm() {
  const me = await requireUser("roles.manage");
  return (
    <RoleForm
      action={saveRole.bind(null, null)}
      groups={PERMISSION_GROUPS.map((g) => ({ label: g.label, permissions: [...g.permissions] }))}
      grantable={[...me.permissions]}
      values={{ name: "", description: "", permissions: ["dashboard.view"] }}
      submitLabel="Create role"
    />
  );
}
