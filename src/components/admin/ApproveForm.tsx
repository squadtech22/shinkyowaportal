"use client";

import { AdminForm, Field, SubmitButton } from "./forms";
import type { ActionState } from "@/lib/admin/actions";

/** Role picker + Approve button for one pending registration. */
export default function ApproveForm({
  action,
  roles,
  defaultRoleId,
}: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  roles: { id: number; name: string }[];
  defaultRoleId?: number;
}) {
  return (
    <AdminForm action={action} className="flex items-end gap-2">
      <Field label="Role" name="role_id" className="w-48">
        <select name="role_id" id="role_id" defaultValue={defaultRoleId ?? ""} className="input-base py-1.5">
          <option value="">Choose role</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </Field>
      <SubmitButton>Approve</SubmitButton>
    </AdminForm>
  );
}
