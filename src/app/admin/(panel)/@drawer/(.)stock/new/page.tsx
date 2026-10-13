import Drawer from "@/components/admin/Drawer";
import NewStockForm from "../../../stock/new/_form";

export default function NewStockDrawer() {
  return (
    <Drawer title="Add vehicle" description="Vehicles start hidden from the website until someone who manages stock shows them.">
      <NewStockForm />
    </Drawer>
  );
}
