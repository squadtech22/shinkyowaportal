import { notFound } from "next/navigation";
import CustomerForm from "@/components/admin/CustomerForm";
import EditorFrame from "@/components/admin/EditorFrame";
import { saveCustomer } from "@/actions/admin/customers";
import { assignableAgents, requireUser } from "@/lib/admin/auth";
import { getCustomer } from "@/lib/admin/customers";
import { countryOptions, currencyOptions } from "@/lib/admin/lookups";

/** Edit-customer form, as a page or in the drawer. */
export default async function CustomerEditor({ id, inDrawer }: { id: number; inDrawer?: boolean }) {
  const user = await requireUser("customers.manage");
  const [data, countries, currencies, agents] = await Promise.all([
    getCustomer(user, id),
    countryOptions(),
    currencyOptions(),
    assignableAgents(user),
  ]);
  if (!data) notFound();
  const c = data.customer;
  const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return (
    <EditorFrame inDrawer={inDrawer} title={`Edit ${c.name}`} back={{ href: `/admin/customers/${c.id}`, label: c.name }}>
      <CustomerForm
        action={saveCustomer.bind(null, c.id)}
        countries={countries}
        currencies={currencies}
        agents={agents}
        hasLogin={Boolean(c.has_login)}
        submitLabel="Save changes"
        values={{
          name: str(c.name), company: str(c.company), email: str(c.email), phone: str(c.phone),
          whatsapp: str(c.whatsapp), address: str(c.address), city: str(c.city), country_id: str(c.country_id),
          currency_id: str(c.currency_id), agent_id: str(c.agent_id), description: str(c.description),
        }}
      />
    </EditorFrame>
  );
}
