# Shinkyowa International — public website (Next.js + MySQL)

A Next.js (Node.js) rebuild of the public site from the Laravel project in `../shinkyowa-5s4d87e5`
(`resources/views/web/*`). Markup, class names and CSS are kept identical to the original.
All vehicles, makes, body types, countries, currencies, contact details, bank details and form
submissions live in MySQL; editing a row updates the site on the next page load.

## Setup

1. MySQL 8 running locally (this machine: Windows service `MySQL84`, port 3306).
2. Copy `.env.example` to `.env.local` and fill in the database user/password.
3. Create the tables and load the starting data:

```bash
npm install
npm run db:setup              # safe to rerun; creates/updates tables, no sample data
npm run db:setup -- --fresh   # drop the website tables and start over
npm run dev                   # http://localhost:3000
npm run build && npm start
```

## Database

Tables follow the Laravel migrations, so the Laravel admin panel can use the same data.

| Table | Used for |
| --- | --- |
| `stocks` | Vehicles (`images` / `features` are JSON arrays as text; relative image paths are served from `https://crm.shinkyowa.com/storage/`) |
| `makes`, `body_types`, `categories`, `countries`, `currencies` | Sidebar tiles, filters, vehicle details. `makes.image` is the logo path on `https://api.shinkyowa.com/` |
| `inquiries` | "Send Enquiry" form on each vehicle page (one per visitor IP per vehicle) |
| `shipments`, `shipment_stock` | Vessels and the vehicles on board (one vessel per vehicle) |
| `documents` | Export paperwork per vehicle (file paths in `storage/uploads/documents/`) |
| `points` | Customer loyalty points |
| `client_sessions` | Customer portal sign-ins |
| `contact_messages` | Header "Contact Us" dialog |
| `newsletter_subscribers` | Footer newsletter boxes |
| `settings` | Email, phones, WhatsApp, social links, office addresses/hours, notice popup (`notice_enabled` = 1/0, `notice_title`, `notice_body`) |
| `info_rows` | Label/value tables: section `bank_details` (Sales & Bank Details page), `company_profile` (Company Profile page), ordered by `sort_order` |

Files: `db/schema.sql` (tables), `db/seed-data.mjs` (starting data), `db/setup.mjs` (loader).

## Code layout

| Path | What |
| --- | --- |
| `public/css/*.css` | The original site CSS, copied unchanged. |
| `src/lib/db.ts` | `mysql2` connection pool (reads `.env.local`). |
| `src/lib/stock.ts` | SQL ports of the Laravel stock / filter / search / sidebar queries. |
| `src/app/actions.ts`, `src/app/vehicle-info/[id]/actions.ts` | Server actions that save form submissions. |
| `src/app/layout.tsx` | Header, footer, overlays; renders every page per request so data is always current. |
| `src/components/WebLayout.tsx` | Port of `web/layouts/app.blade.php`: sidebars, home slider, page CSS. |

## Routes

`/`, `/stock`, `/filter`, `/stock-search`, `/make/[make]`, `/type/[type]`, `/country/[country]`,
`/category/[category]`, `/vehicle-info/[id]`, `/services/shipping`, `/about-us/company-profile`,
`/about-us/why-choose-us`, `/sales-and-bank-details` — the same URLs as the Laravel site.

## Not included

- The 42 starting vehicles are sample data with placeholder photos.

## Admin panel (`/admin`)

Sign in at `/admin/login`. The first `npm run db:setup` creates a Super Admin
(`ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env.local`, or `admin@shinkyowa.com` with a
random password printed once).

| Section | What it does | Permission |
| --- | --- | --- |
| Dashboard | Money received (yen), this month vs last, pending TT, outstanding balances, 12-month chart | `dashboard.view` |
| Stock | Add / edit / delete vehicles with photo uploads; “Show on website” off hides a vehicle (e.g. bought for a customer) from the public site. Status is automatic: Available → Reserved → Shipped → Cleared (shipped and fully paid) | `stock.view`, `stock.manage` |
| Finance | Purchase costs per vehicle (auction, lot, bought price, expenses, exchange rate, deposit %), profit report per business year (Sep–Aug) by salesperson / country / month / customer, purchase ledger with Excel (CSV) export, Japan payments (money paid to auctions, transport, freight) | `finance.view`, `finance.manage` |
| Customers | Accounts, portal login, reserve vehicles at a CNF price, balance, loyalty points, printable account statement | `customers.view`, `customers.manage`, `customers.view_all`, `customers.view_team` |
| Payments | Record TTs (with TT copy and bank received date), approve pending payments | `payments.view`, `payments.manage`, `payments.approve` |
| Reserved vehicles | Every reserved vehicle with its balance, vessel and paperwork; reserve for any customer | `customers.view`, `customers.manage` |
| Shipments | Vessels (name, RoRo or container, container no., B/L no., ETD, ETA) and the reserved vehicles on board | `shipments.view`, `shipments.manage` |
| Documents | Japanese/English export certificates, final invoice, inspection certificate, B/L per vehicle | `documents.view`, `documents.manage` |
| Inquiries | Vehicle enquiries, contact messages, newsletter subscribers (CSV export) | `inquiries.view`, `inquiries.manage` |
| Website content | Contact details, social links, offices, notice popup, bank details, company profile | `website.manage` |
| Catalog lists | Makes, body types, categories, countries, currencies, auctions, expense types | `catalog.manage` |
| Approvals | Approve or reject people who signed up at `/admin/register`, choosing their role | `users.approve` |
| Users / Roles | Staff logins; create roles (e.g. "Recruiter") and pick their permissions | `users.manage`, `roles.manage` |

- **Sign-up:** the website's Login/Register link opens `/admin/login`, which links to
  `/admin/register`. New accounts wait for approval and only see a "Waiting for approval"
  page until someone with `users.approve` (Manager, Super Admin) approves them.
- **Super Admin** roles always have every permission and cannot be edited or deleted;
  only Super Admins can create other Super Admins.
- Users without `customers.view_all` only see customers assigned to them (and those
  customers' payments, vehicles, shipments, documents and dashboard figures). With
  `customers.view_team` (default role "Team Leader") they also see the customers of
  everyone who reports to them (Users > "Reports to", `users.manager_id`).
- **Loyalty points:** a customer gets +10 points when a vehicle is reserved for them and
  loses them again if the reservation is released (`points` table).
- Permissions are defined in `src/lib/admin/permissions.ts`; every page and server
  action checks them on the server.
- Uploaded photos and TT copies are stored in `storage/uploads/` (back this folder up
  together with the database). Vehicle photos are public at `/uploads/stock/...`; TT
  copies are only served to signed-in staff with `payments.view`.
- Export documents are private files in `storage/uploads/documents/`, served to staff with
  `documents.view` and to the customer who owns the vehicle.
- **Finance** permissions are not part of any default role, so only Super Admins see
  costs and profit until a role is given them. Profit per vehicle = CNF × exchange rate −
  bought price − expenses (all yen); a vehicle counts in the business year of its purchase
  date (Sep–Aug). The public website reads vehicles through the `website_stocks` view
  (`is_listed = 1`), which `npm run db:setup` creates. Run it after updating.
- Demo data for trying the dashboard (sample cars, customers, payments, enquiries):
  `npm run db:setup -- --demo`; remove it with `npm run db:setup -- --remove-demo`.
- My profile > Preferences: each user picks USD or PKR for displayed amounts and a light
  or dark theme. Amounts are converted with the exchange rates on the same page (Finance
  managers edit them; stored as `fx_<code>` in `settings`). Customer statements and the
  customer portal stay in the customer's own currency.

## Customer portal (`/client`)

Buyers sign in at `/client/login` (linked from the staff sign-in page) with their email
and the portal password set on the admin customer form; a password is required when a
customer with an email is added. They see only their own account: balance and payment
progress, loyalty points, reserved vehicles with vessel name / ETD / ETA, downloadable
export documents, payment history (TT copies, received dates) and their sales agent's
contact details, and can change their password.

Customer sessions are separate from staff sessions (`client_sessions` table,
`skw_client_session` cookie), so a customer can never open `/admin`. Ticking "Remove
portal access" on the customer form, or setting a new password, signs them out.
