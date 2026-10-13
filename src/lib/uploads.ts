import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// Uploaded files live in <project>/storage/uploads/<folder>/ (outside /public:
// files added to /public after a build are not served by `next start`).
//   stock/     vehicle photos, public at /uploads/stock/<name>
//   payments/  TT copies, private, served at /admin/files/payments/<name>
//   documents/ export paperwork, private, served at /admin/files/documents/<name>
//              and to the owning customer at /client/files/documents/<name>
const ROOT = path.join(process.cwd(), "storage", "uploads");

export type UploadFolder = "stock" | "payments" | "documents";

const MAX_BYTES = 8 * 1024 * 1024;

const TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
};

const ALLOWED: Record<UploadFolder, string[]> = {
  stock: ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"],
  payments: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  documents: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
};

export class UploadError extends Error {}

/** Real File entries from a form field (browsers send an empty File when nothing is chosen). */
export function filesFrom(form: FormData, field: string) {
  return form.getAll(field).filter((f): f is File => f instanceof File && f.size > 0);
}

/** Saves an upload and returns its stored name, e.g. "stock/3f9a...c1.jpg". */
export async function saveUpload(file: File, folder: UploadFolder) {
  if (!ALLOWED[folder].includes(file.type)) {
    throw new UploadError(`${file.name}: file type not allowed`);
  }
  if (file.size > MAX_BYTES) throw new UploadError(`${file.name}: larger than 8 MB`);
  const name = `${randomBytes(12).toString("hex")}${TYPES[file.type]}`;
  await mkdir(path.join(ROOT, folder), { recursive: true });
  await writeFile(path.join(ROOT, folder, name), Buffer.from(await file.arrayBuffer()));
  return `${folder}/${name}`;
}

/** Resolves a stored name inside the folder, refusing anything that escapes it. */
function resolveStored(stored: string, folder: UploadFolder) {
  const base = path.join(ROOT, folder);
  const full = path.resolve(base, stored.replace(new RegExp(`^${folder}/`), ""));
  return full.startsWith(base + path.sep) ? full : null;
}

export async function readUpload(stored: string, folder: UploadFolder) {
  const full = resolveStored(stored, folder);
  if (!full) return null;
  try {
    const data = await readFile(full);
    const ext = path.extname(full).toLowerCase();
    const type = Object.entries(TYPES).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
    return { data, type };
  } catch {
    return null;
  }
}

export async function deleteUpload(stored: string | null | undefined, folder: UploadFolder) {
  if (!stored || !stored.startsWith(`${folder}/`)) return;
  const full = resolveStored(stored, folder);
  if (full) await unlink(full).catch(() => {});
}

/** Public URL of a stored vehicle photo. */
export const stockUploadUrl = (stored: string) => `/uploads/${stored}`;
