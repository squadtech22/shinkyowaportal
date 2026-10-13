import { saveCommission } from "@/actions/admin/commissions";
import { CommissionForm } from "@/components/admin/CommissionForms";
import { PageHeader } from "@/components/admin/ui";
import { requireUser } from "@/lib/admin/auth";
import { dealVehicleOptions } from "@/lib/admin/finance";
import { staffOptions } from "@/lib/admin/lookups";

export const metadata = { title: "Add commission" };

export default async function NewCommission({ searchParams }: { searchParams: Promise<{ stock?: string; user?: string }> }) {
  await requireUser("commission.manage");
  const sp = await searchParams;
  const [vehicles, staff] = await Promise.all([dealVehicleOptions(), staffOptions()]);
  return (
    <>
      <PageHeader
        title="Add commission"
        description="For any vehicle and staff member, e.g. a manager's share of a team sale."
        back={{ href: "/admin/commissions", label: "Commissions" }}
      />
      <CommissionForm
        action={saveCommission.bind(null, null)}
        vehicles={vehicles}
        staff={staff}
        values={{ stock_id: sp.stock ?? "", user_id: sp.user ?? "", type: "percent", rate: "", note: "" }}
      />
    </>
  );
}
