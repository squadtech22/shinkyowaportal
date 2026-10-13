import type { RowDataPacket } from "mysql2";
import { ExternalLink } from "lucide-react";
import { InfoRowsForm, SettingsGroupForm } from "@/components/admin/WebsiteForms";
import { ButtonLink, Card, CardHeader, PageHeader } from "@/components/admin/ui";
import { saveInfoRows, saveSettings } from "@/actions/admin/website";
import { requireUser } from "@/lib/admin/auth";
import { INFO_SECTIONS, SETTING_GROUPS, type InfoSection } from "@/lib/admin/website";
import { db } from "@/lib/db";

export const metadata = { title: "Website content" };

// Labels offered for an empty section, so only the values need typing.
const SUGGESTED: Partial<Record<InfoSection, string[]>> = {
  intermediary_bank: ["Intermediary Bank", "Swift Code", "Address", "Account No", "Account Holder"],
};

const PAGE_LINKS: Record<InfoSection, string> = {
  bank_details: "/sales-and-bank-details",
  intermediary_bank: "/sales-and-bank-details",
  company_profile: "/about-us/company-profile",
};

export default async function WebsiteContent() {
  await requireUser("website.manage");
  const [[settings], [info]] = await Promise.all([
    db.query<RowDataPacket[]>("SELECT `key`, value FROM settings"),
    db.query<RowDataPacket[]>("SELECT section, label, value FROM info_rows ORDER BY sort_order, id"),
  ]);
  const values = Object.fromEntries(settings.map((s) => [s.key, s.value ?? ""]));

  return (
    <>
      <PageHeader
        title="Website content"
        description="Changes are live on the website as soon as you save."
        actions={<ButtonLink href="/" variant="secondary" icon={ExternalLink} external>Open website</ButtonLink>}
      />
      <div className="grid gap-6 xl:grid-cols-2">
        {SETTING_GROUPS.map((group, i) => (
          <Card key={group.title} className={group.title === "Notice popup" ? "xl:col-span-2" : undefined}>
            <CardHeader title={group.title} description={group.description} />
            <SettingsGroupForm action={saveSettings.bind(null, i)} fields={group.fields} values={values} />
          </Card>
        ))}
        {(Object.keys(INFO_SECTIONS) as InfoSection[]).map((section) => (
          <Card key={section} className="xl:col-span-2">
            <CardHeader
              title={INFO_SECTIONS[section].title}
              description={INFO_SECTIONS[section].description}
              actions={
                <a href={PAGE_LINKS[section]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-800">
                  View page <ExternalLink className="size-3.5" />
                </a>
              }
            />
            <InfoRowsForm
              action={saveInfoRows.bind(null, section)}
              rows={(() => {
                const rows = info.filter((r) => r.section === section).map((r) => ({ label: String(r.label), value: String(r.value) }));
                return rows.length ? rows : (SUGGESTED[section] ?? []).map((label) => ({ label, value: "" }));
              })()}
            />
          </Card>
        ))}
      </div>
    </>
  );
}
