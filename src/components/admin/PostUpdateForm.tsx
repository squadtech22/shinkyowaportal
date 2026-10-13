"use client";

import { Send } from "lucide-react";
import { AdminForm, Field, SubmitButton } from "./forms";
import type { ActionState } from "@/lib/admin/actions";

/** Staff write an update the customer reads in their portal. */
export default function PostUpdateForm({
  action,
  vehicles,
}: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  vehicles: { id: number; label: string }[];
}) {
  return (
    <AdminForm action={action} resetOnSuccess className="space-y-3 border-t border-slate-100 p-5">
      <Field label="Send the customer an update" name="message">
        <textarea
          id="message"
          name="message"
          rows={2}
          maxLength={500}
          placeholder="e.g. Inspection done — the car is in great condition and goes to the port on Monday."
          className="input-base"
        />
      </Field>
      <div className="flex flex-wrap items-end gap-3">
        {vehicles.length > 0 && (
          <Field label="About" name="stock_id" className="min-w-48 flex-1">
            <select id="stock_id" name="stock_id" defaultValue="" className="input-base">
              <option value="">Their whole account</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
          </Field>
        )}
        <SubmitButton>
          <Send className="size-4" /> Send update
        </SubmitButton>
      </div>
    </AdminForm>
  );
}
