import { Card, PageHeader } from "@/components/admin/ui";
import JapanPaymentEditor from "../_form";

export const metadata = { title: "Record Japan payment" };

export default function NewJapanPayment() {
  return (
    <>
      <PageHeader title="Record Japan payment" back={{ href: "/admin/finance/japan-payments", label: "Japan payments" }} />
      <Card>
        <JapanPaymentEditor id={null} />
      </Card>
    </>
  );
}
