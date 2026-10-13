import { Download } from "lucide-react";
import { importStock } from "@/actions/admin/stock-import";
import StockImportForm from "@/components/admin/StockImportForm";
import { buttonClass, PageHeader } from "@/components/admin/ui";
import { requireUser } from "@/lib/admin/auth";

export const metadata = { title: "Import vehicles" };

export default async function StockImport() {
  await requireUser("stock.manage");
  return (
    <>
      <PageHeader
        title="Import vehicles from Excel"
        description="Bulk-add or update vehicles, customers, purchase costs and vessels. You see every change before anything is saved."
        back={{ href: "/admin/stock", label: "Stock" }}
        actions={
          // Plain link: a file download, not a page.
          <a href="/admin/stock-import/template.xlsx" download className={buttonClass("secondary")}>
            <Download className="size-4" /> Download template
          </a>
        }
      />
      <StockImportForm action={importStock} />
    </>
  );
}
