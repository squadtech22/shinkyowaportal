import { Badge, Card, CardHeader, PageHeader } from "@/components/admin/ui";
import { can, requireUser } from "@/lib/admin/auth";
import { getRates } from "@/lib/admin/display";
import { PERMISSION_LIST } from "@/lib/admin/permissions";
import { ExchangeRatesForm, PasswordForm, PreferencesForm, ProfileForm } from "./ProfileForms";

export const metadata = { title: "My profile" };

export default async function Profile() {
  const user = await requireUser();
  const mine = PERMISSION_LIST.filter((p) => user.isSuper || user.permissions.has(p.key));
  const { list: rates } = await getRates();
  const manageRates = can(user, "finance.manage");
  const pkr = rates.find((r) => r.code === "PKR")?.rate;
  const jpy = rates.find((r) => r.code === "JPY")?.rate;
  const rateNote = `Every amount in the admin panel is converted for display. Rates: 1 USD = ${pkr ?? "?"} PKR${jpy ? ` = ${jpy} JPY` : ""}${manageRates ? " (edit below)." : "."} Forms still take amounts in their own currency.`;
  return (
    <>
      <PageHeader title="My profile" description="Your sign-in details and preferences." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profile" />
          <ProfileForm name={user.name} email={user.email} />
        </Card>
        <Card>
          <CardHeader title="Password" />
          <PasswordForm />
        </Card>
        <Card className={manageRates ? undefined : "lg:col-span-2"}>
          <CardHeader title="Preferences" description="Only for you." />
          <PreferencesForm currency={user.currency} theme={user.theme} rateNote={rateNote} />
        </Card>
        {manageRates && (
          <Card>
            <CardHeader title="Exchange rates" description="How much of each currency is 1 US dollar. Used for everyone." />
            <ExchangeRatesForm rates={rates.map(({ code, rate, saved }) => ({ code, rate, saved }))} />
          </Card>
        )}
        <Card className="lg:col-span-2">
          <CardHeader title={`Your role: ${user.roleName}`} description="What you can do in the admin panel." />
          <div className="flex flex-wrap gap-2 p-5">
            {user.isSuper ? (
              <Badge tone="red">Every permission</Badge>
            ) : mine.length === 0 ? (
              <span className="text-sm text-slate-500">Your role has no permissions yet. Ask a Super Admin.</span>
            ) : (
              mine.map((p) => (
                <Badge key={p.key} tone="brand">{p.label}</Badge>
              ))
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
