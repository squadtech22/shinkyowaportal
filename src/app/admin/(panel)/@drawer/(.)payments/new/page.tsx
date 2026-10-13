import Drawer from "@/components/admin/Drawer";
import NewPaymentForm from "../../../payments/new/_form";

export default async function NewPaymentDrawer({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  return (
    <Drawer title="Record payment" description="Add a telegraphic transfer (TT) received from a customer.">
      <NewPaymentForm customer={(await searchParams).customer} />
    </Drawer>
  );
}
