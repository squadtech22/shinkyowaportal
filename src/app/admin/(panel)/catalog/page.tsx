import type { RowDataPacket } from "mysql2";
import CatalogEditor from "@/components/admin/CatalogEditor";
import { Card, CardHeader, PageHeader, Tabs } from "@/components/admin/ui";
import { deleteCatalogItem, saveCatalogItem } from "@/actions/admin/catalog";
import { requireUser } from "@/lib/admin/auth";
import { CATALOG, isCatalogTable, type CatalogTable } from "@/lib/admin/catalog";
import { IMAGE_API_URL } from "@/lib/data";
import { db } from "@/lib/db";

export const metadata = { title: "Catalog lists" };

export default async function Catalog({ searchParams }: { searchParams: Promise<{ list?: string }> }) {
  await requireUser("catalog.manage");
  const { list = "makes" } = await searchParams;
  const table: CatalogTable = isCatalogTable(list) ? list : "makes";
  const config = CATALOG[table];

  // Row values plus how many records use each row.
  const usageSql = config.usage
    .map((u) => `(SELECT COUNT(*) FROM ${u.table} x WHERE x.${u.column} = t.id)`)
    .join(" + ");
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT t.id, ${config.columns.map((c) => `t.${c.key}`).join(", ")}, ${usageSql} AS used FROM ${table} t ORDER BY t.id`,
  );

  return (
    <>
      <PageHeader title="Catalog lists" description="Options used across the website and the admin forms." />
      <Tabs
        active={table}
        tabs={(Object.keys(CATALOG) as CatalogTable[]).map((key) => ({
          key,
          label: CATALOG[key].title,
          href: `/admin/catalog${key === "makes" ? "" : `?list=${key}`}`,
        }))}
      />
      <Card>
        <CardHeader title={config.title} description={config.description} />
        <CatalogEditor
          key={table}
          columns={config.columns}
          rows={rows.map((r) => ({
            id: Number(r.id),
            usage: Number(r.used),
            values: Object.fromEntries(config.columns.map((c) => [c.key, r[c.key] ? String(r[c.key]) : ""])),
          }))}
          save={saveCatalogItem.bind(null, table)}
          remove={deleteCatalogItem.bind(null, table)}
          imageBase={table === "makes" ? IMAGE_API_URL : undefined}
        />
      </Card>
    </>
  );
}
