import { PageHeader } from "@/components/admin/ui";
import NewUserForm from "./_form";

export const metadata = { title: "Add user" };

export default function NewUser() {
  return (
    <>
      <PageHeader
        title="Add user"
        description="They sign in at /login with this email and password."
        back={{ href: "/admin/users", label: "Users" }}
      />
      <NewUserForm />
    </>
  );
}
