import { PageHeader } from "@/components/admin/ui";
import NewRoleForm from "./_form";

export const metadata = { title: "Create role" };

export default function NewRole() {
  return (
    <>
      <PageHeader
        title="Create role"
        description="For example a Recruiter who can only see inquiries and customers."
        back={{ href: "/admin/roles", label: "Roles" }}
      />
      <NewRoleForm />
    </>
  );
}
