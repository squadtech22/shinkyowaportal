import { PageHeader } from "@/components/admin/ui";
import NewCustomerForm from "./_form";

export const metadata = { title: "Add customer" };

export default function NewCustomer() {
  return (
    <>
      <PageHeader title="Add customer" back={{ href: "/admin/customers", label: "Customers" }} />
      <NewCustomerForm />
    </>
  );
}
