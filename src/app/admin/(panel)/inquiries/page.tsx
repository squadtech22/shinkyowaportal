import Link from "next/link";
import type { RowDataPacket } from "mysql2";
import { Download, Inbox, Mail, MessageCircle, Phone, Trash2 } from "lucide-react";
import StatusSelect from "@/components/admin/StatusSelect";
import { ConfirmButton } from "@/components/admin/forms";
import { ButtonLink, Card, EmptyState, PageHeader, Pager, Table, Tabs, Td, Th } from "@/components/admin/ui";
import { deleteInquiry, deleteSubscriber, setInquiryStatus } from "@/actions/admin/inquiries";
import { can, requireUser } from "@/lib/admin/auth";
import { dateTime } from "@/lib/admin/format";
import { db } from "@/lib/db";

export const metadata = { title: "Inquiries" };

const PER_PAGE = 20;
type Search = Promise<{ tab?: string; status?: string; page?: string }>;

export default async function Inquiries({ searchParams }: { searchParams: Search }) {
  const user = await requireUser("inquiries.view");
  const { tab = "vehicle", status = "open", page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const canManage = can(user, "inquiries.manage");

  const [[counts]] = await db.query<RowDataPacket[]>(
    `SELECT (SELECT COUNT(*) FROM inquiries WHERE status = 'new') AS vehicle,
            (SELECT COUNT(*) FROM contact_messages WHERE status = 'new') AS contact,
            (SELECT COUNT(*) FROM newsletter_subscribers) AS subscribers`,
  );
  const href = (p: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ tab, status, ...p })) {
      if (v && !(k === "tab" && v === "vehicle") && !(k === "status" && v === "open")) sp.set(k, String(v));
    }
    return `/admin/inquiries${sp.size ? `?${sp}` : ""}`;
  };
  const statusWhere = status === "all" ? "1 = 1" : status === "closed" ? "x.status = 'closed'" : "x.status <> 'closed'";

  let body: React.ReactNode;
  let total = 0;

  if (tab === "subscribers") {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT id, email, created_at FROM newsletter_subscribers ORDER BY id DESC LIMIT ? OFFSET ?",
      [PER_PAGE, (page - 1) * PER_PAGE],
    );
    total = Number(counts.subscribers);
    body =
      rows.length === 0 ? (
        <EmptyState icon={Mail} title="No subscribers yet" description="Emails from the website's newsletter boxes appear here." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Email</Th>
              <Th>Subscribed</Th>
              <Th className="text-right"><span className="sr-only">Actions</span></Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td>
                  <a href={`mailto:${r.email}`} className="font-medium hover:text-brand-700">{r.email}</a>
                </Td>
                <Td label="Subscribed" className="text-slate-500">{dateTime(r.created_at)}</Td>
                <Td actions className="text-right">
                  {canManage && (
                    <ConfirmButton action={deleteSubscriber.bind(null, r.id)} title="Remove this subscriber?" confirmLabel="Remove">
                      Remove
                    </ConfirmButton>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      );
  } else {
    const kind = tab === "contact" ? "contact" : "vehicle";
    const sql =
      kind === "vehicle"
        ? `SELECT x.*, co.name AS destination, s.id AS vehicle_id, s.sid, s.year, s.model, m.name AS make
           FROM inquiries x
           LEFT JOIN countries co ON co.id = x.country_id
           LEFT JOIN stocks s ON s.id = x.stock_id
           LEFT JOIN makes m ON m.id = s.make_id
           WHERE ${statusWhere}`
        : `SELECT x.* FROM contact_messages x WHERE ${statusWhere}`;
    const [[[{ n }]], [rows]] = await Promise.all([
      db.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM (${sql}) t`),
      db.query<RowDataPacket[]>(`${sql} ORDER BY x.id DESC LIMIT ? OFFSET ?`, [PER_PAGE, (page - 1) * PER_PAGE]),
    ]);
    total = Number(n);
    body =
      rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={status === "closed" ? "Nothing closed yet" : "You're all caught up"}
          description={kind === "vehicle" ? "Enquiries sent from vehicle pages appear here." : "Messages from the website's Contact Us form appear here."}
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.id} className="grid gap-4 p-5 lg:grid-cols-[260px_1fr_auto]">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{r.name}</p>
                <div className="mt-1.5 space-y-1 text-sm text-slate-600">
                  <a href={`mailto:${r.email}`} className="flex items-center gap-2 break-all hover:text-brand-700">
                    <Mail className="size-3.5 shrink-0 text-slate-400" /> {r.email}
                  </a>
                  {r.phone && (
                    <span className="flex items-center gap-2">
                      <Phone className="size-3.5 shrink-0 text-slate-400" /> {r.phone}
                      <a href={`https://wa.me/${String(r.phone).replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="text-emerald-600 hover:text-emerald-700" title="WhatsApp">
                        <MessageCircle className="size-3.5" />
                      </a>
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-400">{dateTime(r.created_at)}</p>
              </div>
              <div className="min-w-0">
                {kind === "vehicle" && (
                  <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {r.vehicle_id ? (
                      <a href={`/vehicle-info/${r.vehicle_id}`} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">
                        SKI-{r.sid} · {r.year} {r.make} {r.model}
                      </a>
                    ) : (
                      <span>Vehicle removed</span>
                    )}
                    {r.destination && <span>Destination: {r.destination}</span>}
                    {r.country && <span>From: {r.country}</span>}
                  </div>
                )}
                <p className="text-sm whitespace-pre-line text-slate-700">{r.message}</p>
              </div>
              <div className="flex items-start gap-2 lg:flex-col lg:items-end">
                <StatusSelect value={r.status} action={setInquiryStatus.bind(null, kind, r.id)} disabled={!canManage} />
                {canManage && (
                  <ConfirmButton action={deleteInquiry.bind(null, kind, r.id)} title="Delete this message?" description="This cannot be undone.">
                    <Trash2 className="size-3.5" />
                  </ConfirmButton>
                )}
              </div>
            </li>
          ))}
        </ul>
      );
  }
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <>
      <PageHeader
        title="Inquiries"
        description="Messages and leads from the website."
        actions={
          tab === "subscribers" && (
            <ButtonLink href="/admin/inquiries/subscribers.csv" variant="secondary" icon={Download} external>
              Export CSV
            </ButtonLink>
          )
        }
      />
      <Tabs
        active={tab}
        tabs={[
          { key: "vehicle", label: "Vehicle enquiries", href: href({ tab: "vehicle", page: undefined }), count: Number(counts.vehicle) },
          { key: "contact", label: "Contact messages", href: href({ tab: "contact", page: undefined }), count: Number(counts.contact) },
          { key: "subscribers", label: "Newsletter", href: href({ tab: "subscribers", page: undefined, status: undefined }), count: Number(counts.subscribers) },
        ]}
      />
      <Card>
        {tab !== "subscribers" && (
          <div className="flex gap-1 border-b border-slate-100 px-4 py-3 text-sm">
            {[
              ["open", "Open"],
              ["closed", "Closed"],
              ["all", "All"],
            ].map(([key, label]) => (
              <Link
                key={key}
                href={href({ status: key, page: undefined })}
                className={
                  status === key
                    ? "rounded-lg bg-brand-50 px-3 py-1 font-medium text-brand-700"
                    : "rounded-lg px-3 py-1 text-slate-600 hover:bg-slate-100"
                }
              >
                {label}
              </Link>
            ))}
          </div>
        )}
        {body}
        <div className="border-t border-slate-100">
          <Pager page={page} lastPage={lastPage} total={total} hrefFor={(p) => href({ page: p })} />
        </div>
      </Card>
    </>
  );
}
