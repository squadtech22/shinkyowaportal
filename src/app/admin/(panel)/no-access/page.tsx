import { ShieldAlert } from "lucide-react";
import { ButtonLink, Card, EmptyState } from "@/components/admin/ui";

export const metadata = { title: "No access" };

export default function NoAccess() {
  return (
    <Card>
      <EmptyState
        icon={ShieldAlert}
        title="You don't have access to this page"
        description="Your role does not include the permission this page needs. Ask a Super Admin to update your role."
        action={<ButtonLink href="/admin/profile" variant="secondary">Go to my profile</ButtonLink>}
      />
    </Card>
  );
}
