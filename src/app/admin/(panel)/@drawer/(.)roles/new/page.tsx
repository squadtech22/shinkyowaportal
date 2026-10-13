import Drawer from "@/components/admin/Drawer";
import NewRoleForm from "../../../roles/new/_form";

export default function NewRoleDrawer() {
  return (
    <Drawer title="Create role" description="For example a Recruiter who can only see inquiries and customers.">
      <NewRoleForm />
    </Drawer>
  );
}
