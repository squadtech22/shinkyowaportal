import Drawer from "@/components/admin/Drawer";
import NewUserForm from "../../../users/new/_form";

export default function NewUserDrawer() {
  return (
    <Drawer title="Add user" description="They sign in at /login with this email and password.">
      <NewUserForm />
    </Drawer>
  );
}
