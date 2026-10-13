import { notFound } from "next/navigation";
import Drawer from "@/components/admin/Drawer";
import { Card } from "@/components/admin/ui";
import JapanPaymentEditor from "../../../../finance/japan-payments/_form";

export default async function EditJapanPaymentDrawer({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  return (
    <Drawer title="Edit Japan payment">
      <Card>
        <JapanPaymentEditor id={id} />
      </Card>
    </Drawer>
  );
}
