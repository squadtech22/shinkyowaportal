import { PageHeader } from "@/components/admin/ui";
import NewStockForm from "./_form";

export const metadata = { title: "Add vehicle" };

export default function NewStock() {
  return (
    <>
      <PageHeader
        title="Add vehicle"
        description="Vehicles start hidden from the website until someone who manages stock shows them."
        back={{ href: "/admin/stock", label: "Stock" }}
      />
      <NewStockForm />
    </>
  );
}
