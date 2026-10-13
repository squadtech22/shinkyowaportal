import Drawer from "@/components/admin/Drawer";
import NewCustomerForm from "../../../customers/new/_form";

export default function NewCustomerDrawer() {
  return (
    <Drawer title="Add customer">
      <NewCustomerForm />
    </Drawer>
  );
}
