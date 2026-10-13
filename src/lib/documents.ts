// Export paperwork kept per vehicle: one column of the `documents` table each.
// Shared by the admin panel, the customer portal and the file routes.

export const DOCUMENT_TYPES = [
  { key: "japanese_export", label: "Japanese export certificate", short: "JP export" },
  { key: "english_export", label: "English export certificate", short: "EN export" },
  { key: "final_invoice", label: "Final invoice", short: "Invoice" },
  { key: "inspection_certificate", label: "Inspection certificate", short: "Inspection" },
  { key: "bl_copy", label: "Bill of lading (B/L) copy", short: "B/L" },
] as const;

export type DocumentKey = (typeof DOCUMENT_TYPES)[number]["key"];

export const DOCUMENT_KEYS: DocumentKey[] = DOCUMENT_TYPES.map((d) => d.key);

export const isDocumentKey = (key: string): key is DocumentKey => (DOCUMENT_KEYS as string[]).includes(key);

/** SQL list of the document columns on alias `d`, e.g. "d.japanese_export, d.english_export, ...". */
export const documentColumns = (alias = "d") => DOCUMENT_KEYS.map((k) => `${alias}.${k}`).join(", ");
