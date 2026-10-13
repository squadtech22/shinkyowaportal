import UserForm from "@/components/admin/UserForm";
import { saveUser } from "@/actions/admin/users";
import { can, managesOnlyTeam, requireUser } from "@/lib/admin/auth";
import { staffOptions } from "@/lib/admin/lookups";
import { rolesAssignableBy } from "@/lib/admin/roles";

/** "Add user" form, shown as a page and in the drawer. */
export default async function NewUserForm() {
  const me = await requireUser(["users.manage", "users.manage_team"]);
  const [roles, staff] = await Promise.all([rolesAssignableBy(me), staffOptions()]);
  const agent = roles.find((r) => r.name === "Agent") ?? roles[roles.length - 1];
  return (
    <UserForm
      action={saveUser.bind(null, null)}
      roles={roles}
      managers={staff}
      isNew
      isSelf={false}
      teamOnly={managesOnlyTeam(me)}
      commission={can(me, "commission.manage") ? { type: "", value: "" } : undefined}
      values={{ name: "", email: "", role_id: agent ? String(agent.id) : "", manager_id: "", is_active: true }}
    />
  );
}
