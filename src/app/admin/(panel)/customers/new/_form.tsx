import CustomerForm from "@/components/admin/CustomerForm";
import { saveCustomer } from "@/actions/admin/customers";
import { assignableAgents, requireUser } from "@/lib/admin/auth";
import { countryOptions, currencyOptions } from "@/lib/admin/lookups";

/** "Add customer" form, shown as a page and in the drawer. */
export default async function NewCustomerForm() {
  const user = await requireUser("customers.manage");
  const [countries, currencies, agents] = await Promise.all([countryOptions(), currencyOptions(), assignableAgents(user)]);
  const usd = currencies.find((c) => c.name.startsWith("USD"));
  return (
    <CustomerForm
      action={saveCustomer.bind(null, null)}
      countries={countries}
      currencies={currencies}
      agents={agents}
      hasLogin={null}
      submitLabel="Add customer"
      values={{
        name: "", company: "", email: "", phone: "", whatsapp: "", address: "", city: "", country_id: "",
        currency_id: usd ? String(usd.id) : "", agent_id: String(user.id), description: "",
      }}
    />
  );
}
