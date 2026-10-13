// Editable website settings (rows of the `settings` table) grouped for the
// Website content page. The public site reads them in src/lib/settings.ts.

export type SettingField = {
  key: string;
  label: string;
  hint?: string;
  type?: "text" | "url" | "email" | "textarea" | "toggle";
};

export const SETTING_GROUPS: { title: string; description: string; fields: SettingField[] }[] = [
  {
    title: "Contact details",
    description: "Shown in the header, mobile menu and footer.",
    fields: [
      { key: "email", label: "Email", type: "email" },
      { key: "phones", label: "Phone numbers", hint: "Separate with commas. The first one is the main number." },
      { key: "whatsapp_number", label: "WhatsApp number", hint: "Digits only with country code, e.g. 817074270468" },
      { key: "office_hours", label: "Office hours" },
    ],
  },
  {
    title: "Social media",
    description: "Leave empty to hide an icon.",
    fields: [
      { key: "facebook_url", label: "Facebook", type: "url" },
      { key: "linkedin_url", label: "LinkedIn", type: "url" },
      { key: "instagram_url", label: "Instagram", type: "url" },
    ],
  },
  {
    title: "Offices",
    description: "Addresses in the footer.",
    fields: [
      { key: "head_office_address", label: "Head office address" },
      { key: "head_office_post_code", label: "Head office post code" },
      { key: "head_office_tel_fax", label: "Head office tel & fax" },
      { key: "toyama_office_address", label: "Toyama office address" },
      { key: "toyama_office_post_code", label: "Toyama office post code" },
      { key: "toyama_office_tel_fax", label: "Toyama office tel & fax" },
    ],
  },
  {
    title: "Notice popup",
    description: "The announcement shown when visitors open the website.",
    fields: [
      { key: "notice_enabled", label: "Show the popup", type: "toggle" },
      { key: "notice_title", label: "Title" },
      { key: "notice_body", label: "Message", type: "textarea" },
    ],
  },
];

export const SETTING_KEYS = SETTING_GROUPS.flatMap((g) => g.fields.map((f) => f.key));

export const INFO_SECTIONS = {
  bank_details: { title: "Bank details", description: "The table on the Sales & Bank Details page." },
  intermediary_bank: {
    title: "Intermediary bank details",
    description: "Correspondent bank for international (TT) transfers, shown under the bank details. Rows left without a value are not shown; with none, the table is hidden.",
  },
  company_profile: { title: "Company profile", description: "The table on the Company Profile page." },
} as const;

export type InfoSection = keyof typeof INFO_SECTIONS;
