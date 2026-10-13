import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, Car, FileText, KeyRound, Mail, MapPin, MessageCircle, Pencil, Phone, Plus, Trash2, Wallet } from "lucide-react";
import DocumentChips from "@/components/admin/DocumentChips";
import PostUpdateForm from "@/components/admin/PostUpdateForm";
import UpdatesFeed from "@/components/admin/UpdatesFeed";
import PaymentBalance, { alertRowClass, PaymentStatus, type PaymentFlowRow } from "@/components/admin/PaymentDue";
import PaymentReview from "@/components/admin/PaymentReview";
import ShipmentBadge from "@/components/admin/ShipmentBadge";
import { ConfirmButton } from "@/components/admin/forms";
import { CnfEditor, ReserveVehicleForm } from "@/components/admin/Reservations";
import { Badge, ButtonLink, Card, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@/components/admin/ui";
import { deleteCustomer, postCustomerUpdate, releaseVehicle, reserveVehicle, updateReservationPrice } from "@/actions/admin/customers";
import { approvePayment, rejectPayment, unapprovePayment } from "@/actions/admin/payments";
import { can, requireUser } from "@/lib/admin/auth";
import { availableVehicles, getCustomer } from "@/lib/admin/customers";
import { getFormat } from "@/lib/admin/display";
import { date, dateTime } from "@/lib/admin/format";
import { shipmentStatus } from "@/lib/admin/shipments";
import { listUpdates } from "@/lib/admin/updates";
import { vehicleHref } from "@/lib/admin/vehicle-link";

export const metadata = { title: "Customer" };

export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { yen, money } = await getFormat();
  const user = await requireUser("customers.view");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const data = await getCustomer(user, id);
  if (!data) notFound();
  const { customer: c, cars, payments } = data;
  const updates = await listUpdates(c.id);
  const canManage = can(user, "customers.manage");
  const symbol = c.symbol ?? "";
  const owed = Number(c.owed);
  const paid = Number(c.paid);
  const pending = Number(c.pending);
  const balance = Math.max(owed - paid, 0);
  const pct = owed > 0 ? Math.min(100, Math.round((paid / owed) * 100)) : 0;
  const vehicles = canManage ? await availableVehicles() : [];
  const showShipping = can(user, "shipments.view");
  const showDocuments = can(user, "documents.view");

  const contact = [
    { key: "email", icon: Mail, value: c.email, href: c.email ? `mailto:${c.email}` : undefined },
    { key: "phone", icon: Phone, value: c.phone, href: c.phone ? `tel:${c.phone}` : undefined },
    { key: "whatsapp", icon: MessageCircle, value: c.whatsapp, href: c.whatsapp ? `https://wa.me/${String(c.whatsapp).replace(/\D/g, "")}` : undefined },
    { key: "address", icon: MapPin, value: [c.address, c.city, c.country].filter(Boolean).join(", ") },
  ].filter((x) => x.value);

  return (
    <>
      <PageHeader
        title={c.name}
        description={`${c.cid}${c.company ? ` · ${c.company}` : ""}${c.agent ? ` · Agent: ${c.agent}` : ""}`}
        back={{ href: "/admin/customers", label: "Customers" }}
        actions={
          <>
            <ButtonLink href={`/admin/statement/${c.id}`} variant="secondary" icon={FileText}>Statement</ButtonLink>
            {canManage && (
              <>
                <ButtonLink href={`/admin/customers/${c.id}/edit`} variant="secondary" icon={Pencil}>Edit</ButtonLink>
                <ConfirmButton
                  action={deleteCustomer.bind(null, c.id)}
                  title="Delete this customer?"
                  description="Only customers without reserved vehicles or payments can be deleted."
                  size="md"
                >
                  <Trash2 className="size-4" /> Delete
                </ConfirmButton>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Account balance" />
          <div className="grid grid-cols-2 gap-px overflow-hidden bg-slate-100 sm:grid-cols-4">
            {[
              { label: "Total (CNF)", value: money(owed, symbol) },
              { label: "Paid", value: money(paid, symbol), cls: "text-emerald-600" },
              { label: "Pending TT", value: money(pending, symbol), cls: pending ? "text-amber-600" : undefined },
              { label: "Balance due", value: money(balance, symbol), cls: balance ? "text-accent-600" : "text-emerald-600" },
            ].map((s) => (
              <div key={s.label} className="bg-surface px-4 py-3.5 sm:px-5 sm:py-4">
                <p className="text-xs font-medium text-slate-500">{s.label}</p>
                <p className={`mt-1 text-lg font-semibold tabular-nums sm:text-xl ${s.cls ?? "text-slate-900"}`}>{s.value}</p>
              </div>
            ))}
          </div>
          <div className="px-5 py-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Payment progress</span>
              <span>{pct}% paid</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Contact" />
          <ul className="space-y-3 p-5 text-sm">
            {contact.length === 0 && <li className="text-slate-500">No contact details.</li>}
            {contact.map(({ key, icon: Icon, value, href }) => (
              <li key={key} className="flex items-start gap-3">
                <Icon className="mt-0.5 size-4 shrink-0 text-slate-400" />
                {href ? (
                  <a href={href} className="break-all text-slate-700 hover:text-brand-700" target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
                    {value}
                  </a>
                ) : (
                  <span className="text-slate-700">{value}</span>
                )}
              </li>
            ))}
            <li className="flex items-start gap-3 border-t border-slate-100 pt-3">
              <Award className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <span className="text-slate-700">
                <span className="font-semibold tabular-nums">{Number(c.points)}</span> loyalty points
              </span>
            </li>
            <li className="flex items-start gap-3">
              <KeyRound className="mt-0.5 size-4 shrink-0 text-slate-400" />
              {c.has_login ? (
                <span className="text-slate-700">
                  Portal login active
                  <span className={`block text-xs ${c.last_login_at ? "text-slate-500" : "font-medium text-amber-700"}`}>
                    {c.last_login_at ? `Last signed in ${dateTime(c.last_login_at)}` : "Has not signed in yet — send them the link below"}
                  </span>
                  <span className="block text-xs text-slate-500">
                    Signs in at{" "}
                    <a href="/login" target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">
                      /login
                    </a>{" "}
                    with <span className="break-all">{c.email}</span> (or the website&apos;s Login button)
                  </span>
                </span>
              ) : (
                <span className="text-slate-500">
                  No portal login{canManage && " — set a password under Edit"}
                </span>
              )}
            </li>
            {c.description && (
              <li className="flex items-start gap-3 border-t border-slate-100 pt-3">
                <FileText className="mt-0.5 size-4 shrink-0 text-slate-400" />
                <span className="whitespace-pre-line text-slate-600">{c.description}</span>
              </li>
            )}
          </ul>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Updates"
          description="What the customer sees in their portal. Added automatically for reservations, payments, shipping and documents."
        />
        <UpdatesFeed updates={updates} audience="staff" />
        {canManage && (
          <PostUpdateForm
            action={postCustomerUpdate.bind(null, c.id)}
            vehicles={cars.map((car) => ({ id: Number(car.id), label: `SKI-${car.sid} · ${car.year} ${car.make ?? ""} ${car.model}` }))}
          />
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader title="Reserved vehicles" description="The CNF price is what the customer owes for the vehicle." />
        {cars.length === 0 ? (
          <EmptyState icon={Car} title="No reserved vehicles" description={canManage ? "Reserve a vehicle below." : undefined} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="md:max-lg:hidden">Vehicle</Th>
                <Th className="md:max-lg:hidden">Chassis</Th>
                <Th className="text-right">CNF price</Th>
                <Th className="text-right">Paid for this car</Th>
                {showShipping && <Th className="md:max-lg:hidden">Shipment</Th>}
                {showDocuments && <Th className="md:max-lg:hidden">Documents</Th>}
                {canManage && <Th className="text-right"><span className="sr-only">Actions</span></Th>}
              </tr>
            </thead>
            <tbody>
              {cars.map((car) => (
                <tr key={car.id}>
                  <Td>
                    {vehicleHref(user, car) ? (
                      <Link href={vehicleHref(user, car)!} className="font-medium hover:text-brand-700">
                        {car.year} {car.make} {car.model}
                      </Link>
                    ) : (
                      <span className="font-medium">{car.year} {car.make} {car.model}</span>
                    )}
                    <p className="text-xs text-slate-500">
                      SKI-{car.sid}
                      {Number(car.is_listed) !== 1 && " · not on website"}
                    </p>
                  </Td>
                  <Td label="Chassis" className="md:max-lg:hidden text-slate-600">{car.chassis}</Td>
                  <Td label="CNF price" className="text-right">
                    <CnfEditor value={Number(car.cnf ?? 0)} symbol={symbol} action={updateReservationPrice.bind(null, car.id)} editable={canManage} />
                  </Td>
                  <Td label="Paid for this car" className="text-right text-slate-600 tabular-nums">{money(Number(car.paid), symbol)}</Td>
                  {showShipping && (
                    <Td label="Shipment" className="md:max-lg:hidden">
                      {car.shipment_id ? (
                        <Link href={`/admin/shipments/${car.shipment_id}`} className="block hover:text-brand-700">
                          <span className="flex flex-wrap items-center gap-1.5 text-sm">
                            {car.vessel_name} <ShipmentBadge status={shipmentStatus(car.etd, car.eta, car.shipment_status)} />
                          </span>
                          <span className="text-xs text-slate-500">ETD {date(car.etd)} · ETA {date(car.eta)}</span>
                        </Link>
                      ) : (
                        <div>
                          <span className="text-sm text-slate-400">Not shipped</span>
                          {can(user, "shipments.manage") && (
                            <Link href={`/admin/shipments/new?stock=${car.id}`} className="mt-1 block text-xs font-medium text-brand-600 hover:underline">
                              Add shipment
                            </Link>
                          )}
                        </div>
                      )}
                    </Td>
                  )}
                  {showDocuments && (
                    <Td label="Documents" className="md:max-lg:hidden">
                      <Link href={`/admin/documents/${car.id}`} className="block" title="Open documents">
                        <DocumentChips row={car} />
                      </Link>
                    </Td>
                  )}
                  {canManage && (
                    <Td actions className="text-right">
                      <ConfirmButton
                        action={releaseVehicle.bind(null, car.id)}
                        title="Release this reservation?"
                        description="The vehicle becomes available again. Payments already recorded stay on the customer's account."
                        confirmLabel="Release"
                      >
                        Release
                      </ConfirmButton>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {canManage && (
          <div className="border-t border-slate-100 bg-slate-50/50 p-5">
            <p className="mb-3 text-sm font-medium text-slate-700">Reserve a vehicle</p>
            <ReserveVehicleForm action={reserveVehicle.bind(null, c.id)} vehicles={vehicles} currencySymbol={symbol} />
          </div>
        )}
      </Card>

      {can(user, "payments.view") && (
        <Card className="mt-6">
          <CardHeader
            title="Payments"
            actions={
              can(user, "payments.manage") && (
                <ButtonLink href={`/admin/payments/new?customer=${c.id}`} size="sm" icon={Plus}>Record payment</ButtonLink>
              )
            }
          />
          {payments.length === 0 ? (
            <EmptyState icon={Wallet} title="No payments yet" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Description</Th>
                  <Th>Vehicle</Th>
                  <Th className="text-right">Amount</Th>
                  <Th>Balance &amp; due</Th>
                  <Th>Status</Th>
                  <Th className="text-right"><span className="sr-only">Actions</span></Th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className={alertRowClass(p.alert)}>
                    <Td label="Date" className="whitespace-nowrap text-slate-600">
                      <div>
                        {date(p.payment_date)}
                        {p.payment_recieved_date && <p className="text-xs text-slate-500">Received {date(p.payment_recieved_date)}</p>}
                      </div>
                    </Td>
                    <Td className="max-md:order-first max-md:font-medium">
                      <Badge tone={p.kind === "balance" ? "blue" : "slate"}>{p.kind === "balance" ? "Balance" : "Advance"}</Badge>{" "}
                      {p.description}
                      {p.recorded_by && <p className="text-xs font-normal text-slate-500">by {p.recorded_by}</p>}
                      {p.file && (
                        <a href={`/admin/files/${p.file}`} target="_blank" rel="noreferrer" className="ml-2 text-xs font-medium text-brand-600 hover:underline">
                          TT copy
                        </a>
                      )}
                    </Td>
                    <Td label="Vehicle" className="md:max-lg:hidden text-slate-600">{p.sid ? `SKI-${p.sid}` : "—"}</Td>
                    <Td label="Amount" className="text-right">
                      <div>
                        <p className="font-medium tabular-nums">{money(p.amount, "$")}</p>
                        <p className="text-xs text-slate-500 tabular-nums">{yen(p.in_yen)}</p>
                      </div>
                    </Td>
                    <Td label="Balance">
                      <PaymentBalance
                        row={p as PaymentFlowRow}
                        money={(n) => money(n, "$")}
                        payHref={can(user, "payments.manage") ? `/admin/payments/${p.id}/balance` : undefined}
                      />
                    </Td>
                    <Td label="Status"><PaymentStatus row={p as PaymentFlowRow} /></Td>
                    <Td actions className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-3">
                        {can(user, "payments.approve") && (
                          <PaymentReview
                            status={p.status}
                            approve={approvePayment.bind(null, p.id)}
                            reject={rejectPayment.bind(null, p.id)}
                            undo={unapprovePayment.bind(null, p.id)}
                          />
                        )}
                        {can(user, "payments.manage") && (p.status !== "approved" || can(user, "payments.approve")) && (
                          <Link href={`/admin/payments/${p.id}`} className="text-sm font-medium text-brand-600 hover:text-brand-800">
                            Edit
                          </Link>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}
    </>
  );
}
