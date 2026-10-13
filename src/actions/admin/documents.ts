"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionState } from "@/lib/admin/actions";
import { authorize, NotAllowedError } from "@/lib/admin/auth";
import { getVehicleDocuments } from "@/lib/admin/documents";
import { setFlash } from "@/lib/admin/flash";
import { db } from "@/lib/db";
import { DOCUMENT_KEYS, DOCUMENT_TYPES, type DocumentKey } from "@/lib/documents";
import { updateForVehicles } from "@/lib/admin/updates";
import { deleteUpload, filesFrom, saveUpload } from "@/lib/uploads";

/**
 * Uploads, replaces or removes a vehicle's export documents. Each document
 * has a file input named after its column and a "remove_<column>" checkbox.
 */
export async function saveDocuments(stockId: number, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("documents.manage");
    const current = await getVehicleDocuments(user, stockId);
    if (!current) throw new NotAllowedError();

    const changes: Partial<Record<DocumentKey, string | null>> = {};
    const saved: string[] = [];
    try {
      for (const key of DOCUMENT_KEYS) {
        const [file] = filesFrom(form, key);
        if (file) {
          const stored = await saveUpload(file, "documents");
          saved.push(stored);
          changes[key] = stored;
        } else if (form.get(`remove_${key}`) === "on" && current[key]) {
          changes[key] = null;
        }
      }
      const keys = Object.keys(changes) as DocumentKey[];
      if (!keys.length) return { error: "Choose a file to upload, or tick a document to remove." };
      const values = DOCUMENT_KEYS.map((k) => (k in changes ? changes[k] : current[k]));
      await db.query(
        `INSERT INTO documents (stock_id, ${DOCUMENT_KEYS.join(", ")}, created_at, updated_at)
         VALUES (?, ${DOCUMENT_KEYS.map(() => "?").join(", ")}, NOW(), NOW())
         ON DUPLICATE KEY UPDATE ${keys.map((k) => `${k} = VALUES(${k})`).join(", ")}, updated_at = NOW()`,
        [stockId, ...values],
      );
    } catch (err) {
      // A file or database write failed: drop the new files and keep the old ones.
      await Promise.all(saved.map((s) => deleteUpload(s, "documents")));
      throw err;
    }
    const keys = Object.keys(changes) as DocumentKey[];
    // Old files go only after the row points at the new ones.
    await Promise.all(keys.map((k) => deleteUpload(current[k], "documents")));

    const uploaded = keys.filter((k) => changes[k]).length;
    if (uploaded) {
      const names = DOCUMENT_TYPES.filter((d) => changes[d.key]).map((d) => d.label);
      await updateForVehicles(
        [stockId],
        "documents",
        (car) => `New document${uploaded === 1 ? "" : "s"} for ${car}: ${names.join(", ")}. Download from your vehicle card.`,
        user.id,
      );
    }
    const removed = keys.length - uploaded;
    await setFlash(
      [uploaded && `${uploaded} document${uploaded === 1 ? "" : "s"} uploaded`, removed && `${removed} removed`]
        .filter(Boolean)
        .join(", "),
    );
    revalidatePath("/admin", "layout");
    revalidatePath("/client");
    return { ok: true };
  });
}
