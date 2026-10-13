import Drawer from "@/components/admin/Drawer";
import { Card } from "@/components/admin/ui";
import JapanPaymentEditor from "../../../../finance/japan-payments/_form";

export default function NewJapanPaymentDrawer() {
  return (
    <Drawer title="Record Japan payment" description="Money paid to an auction house, transport or freight company.">
      <Card>
        <JapanPaymentEditor id={null} />
      </Card>
    </Drawer>
  );
}
