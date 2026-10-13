import Link from "next/link";
import { notFound } from "next/navigation";
import PrintButton from "@/components/admin/PrintButton";
import { requireUser } from "@/lib/admin/auth";
import { getCustomer } from "@/lib/admin/customers";
import { date, money } from "@/lib/admin/format";

export const metadata = { title: "Customer statement" };

// Printable account statement of one customer (the old per-customer
// "ACCOUNTS" sheets): every reserved vehicle with its price, payments and
// shipping, then the payments received. Outside the panel layout so it prints
// without the sidebar.
export default async function Statement({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("customers.view");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const data = await getCustomer(user, id);
  if (!data) notFound();
  const { customer: c, cars, payments } = data;
  const symbol = c.symbol ?? "";
  const owed = Number(c.owed);
  const paid = Number(c.paid);
  const pending = Number(c.pending);
  const received = payments.filter((p) => p.status === "approved");
  const th = "border-b-2 border-slate-300 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500";
  const td = "border-b border-slate-200 px-2 py-2 align-top";

  return (
    <div data-light-only className="mx-auto max-w-4xl bg-white p-6 text-sm sm:my-6 sm:rounded-2xl sm:p-10 sm:shadow-sm print:my-0 print:max-w-none print:p-0 print:shadow-none">
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <Link href={`/admin/customers/${c.id}`} className="text-sm text-slate-500 hover:text-brand-700">← Back to customer</Link>
        <PrintButton />
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-lg font-bold tracking-wide text-brand-900">SHINKYOWA</p>
          <h1 className="mt-1 text-2xl font-semibold">Account statement</h1>
          <p className="text-slate-500">As of {date(new Date())}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold">{c.name}</p>
          {c.company && <p>{c.company}</p>}
          <p className="text-slate-500">{c.cid}</p>
          <p className="text-slate-500">{[c.city, c.country].filter(Boolean).join(", ")}</p>
          {c.agent && <p className="text-slate-500">Agent: {c.agent}</p>}
        </div>
      </header>

      <div className="my-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ["Total (CNF)", money(owed, symbol)],
          ["Received", money(paid, symbol)],
          ["Pending TT", money(pending, symbol)],
          ["Balance due", money(Math.max(owed - paid, 0), symbol)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 px-3 py-2">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-lg font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-2 font-semibold">Vehicles</h2>
      {cars.length === 0 ? (
        <p className="mb-6 text-slate-500">No vehicles reserved.</p>
      ) : (
        <table className="mb-8 w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>Vehicle</th>
              <th className={th}>Chassis</th>
              <th className={th}>Shipped</th>
              <th className={`${th} text-right`}>CNF</th>
              <th className={`${th} text-right`}>Paid</th>
              <th className={`${th} text-right`}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {cars.map((car) => {
              const cnf = Number(car.cnf ?? 0);
              const carPaid = Number(car.paid);
              return (
                <tr key={car.id}>
                  <td className={td}>
                    {car.year} {car.make} {car.model}
                    <p className="text-xs text-slate-500">SKI-{car.sid}</p>
                  </td>
                  <td className={td}>{car.chassis}</td>
                  <td className={td}>
                    {car.vessel_name ? (
                      <>
                        Yes · {car.vessel_name}
                        <p className="text-xs text-slate-500">ETD {date(car.etd)} · ETA {date(car.eta)}</p>
                      </>
                    ) : (
                      "No"
                    )}
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{money(cnf, symbol)}</td>
                  <td className={`${td} text-right tabular-nums`}>{money(carPaid, symbol)}</td>
                  <td className={`${td} text-right font-medium tabular-nums`}>{money(Math.max(cnf - carPaid, 0), symbol)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="px-2 py-2" colSpan={3}>Total</td>
              <td className="px-2 py-2 text-right tabular-nums">{money(owed, symbol)}</td>
              <td className="px-2 py-2 text-right tabular-nums">
                {money(cars.reduce((a, car) => a + Number(car.paid), 0), symbol)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {money(cars.reduce((a, car) => a + Math.max(Number(car.cnf ?? 0) - Number(car.paid), 0), 0), symbol)}
              </td>
            </tr>
          </tfoot>
        </table>
      )}

      <h2 className="mb-2 font-semibold">Payments received</h2>
      {received.length === 0 ? (
        <p className="text-slate-500">No payments received yet.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>Date</th>
              <th className={th}>Description</th>
              <th className={th}>Vehicle</th>
              <th className={`${th} text-right`}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {received.map((p) => (
              <tr key={p.id}>
                <td className={td}>{date(p.payment_recieved_date ?? p.payment_date)}</td>
                <td className={td}>{p.description}</td>
                <td className={td}>{p.sid ? `SKI-${p.sid} · ${p.make ?? ""} ${p.model ?? ""}` : "—"}</td>
                <td className={`${td} text-right tabular-nums`}>{money(Number(p.amount), "$")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {pending > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          {money(pending, symbol)} of TT payments are waiting for confirmation and are not counted as received yet.
        </p>
      )}
    </div>
  );
}
