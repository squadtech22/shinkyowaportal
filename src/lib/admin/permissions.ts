// Every permission a role can be given. Roles store these keys in
// role_permissions; Super Admin roles (roles.is_super) implicitly have all.
// Add a key here and it appears on the role editor automatically.

export const PERMISSION_GROUPS = [
  {
    label: "Dashboard",
    permissions: [{ key: "dashboard.view", label: "View dashboard", hint: "Sales totals, pending payments and activity" }],
  },
  {
    label: "Stock",
    permissions: [
      { key: "stock.view", label: "View stock", hint: "Browse vehicles in the admin panel" },
      {
        key: "stock.add",
        label: "Add vehicles (hidden)",
        hint: "Add vehicles to stock and edit their own; they stay off the website until a manager shows them",
      },
      { key: "stock.manage", label: "Manage stock", hint: "Add, edit and delete vehicles and photos, and choose what is on the website" },
    ],
  },
  {
    label: "Customers",
    permissions: [
      { key: "customers.view", label: "View customers", hint: "Customer accounts and their balances" },
      { key: "customers.manage", label: "Manage customers", hint: "Add and edit customers, reserve vehicles" },
      {
        key: "customers.view_all",
        label: "See all customers",
        hint: "Without this, users only see customers assigned to them",
      },
      {
        key: "customers.view_team",
        label: "See team's customers",
        hint: "Also see customers of users who report to them (Users > Reports to)",
      },
    ],
  },
  {
    label: "Payments",
    permissions: [
      { key: "payments.view", label: "View payments", hint: "Payment history and TT copies" },
      { key: "payments.manage", label: "Record payments", hint: "Add, edit and delete payments" },
      { key: "payments.approve", label: "Approve payments", hint: "Confirm each advance and balance TT as received or not received (admin only by default)" },
    ],
  },
  {
    label: "Shipping & documents",
    permissions: [
      { key: "shipments.view", label: "View shipments", hint: "Vessels, departure (ETD) and arrival (ETA) dates" },
      { key: "shipments.manage", label: "Manage shipments", hint: "Add vessels and assign vehicles to them" },
      { key: "shipments.status", label: "Change shipment status", hint: "Set a vessel to Loading, At sea or Arrived" },
      { key: "documents.view", label: "View documents", hint: "Export certificates, invoices, inspection, B/L" },
      { key: "documents.manage", label: "Upload documents", hint: "Upload, replace and remove export paperwork" },
    ],
  },
  {
    // Of the default roles only Finance Manager has these; others see costs
    // and profit once granted them in Roles & permissions.
    label: "Finance",
    permissions: [
      {
        key: "finance.view",
        label: "View costs & profit",
        hint: "Purchase costs, profit per vehicle, profit reports and Japan payments",
      },
      { key: "finance.manage", label: "Edit costs & Japan payments", hint: "Enter purchase costs and record money paid in Japan" },
    ],
  },
  {
    // Everyone sees their own commission under "My commission"; these cover
    // the steps after that: set (admin) -> approve (CEO) -> pay (finance).
    label: "Commission",
    permissions: [
      {
        key: "commission.manage",
        label: "Set commissions",
        hint: "Set each staff member's rate (% of profit or fixed per car) and add commission to vehicles",
      },
      { key: "commission.approve", label: "Approve commissions", hint: "Approve commission before it is paid" },
      { key: "commission.pay", label: "Pay commissions", hint: "See approved commission and mark it paid" },
    ],
  },
  {
    label: "Inquiries",
    permissions: [
      { key: "inquiries.view", label: "View inquiries", hint: "Vehicle enquiries, contact messages, subscribers" },
      { key: "inquiries.manage", label: "Manage inquiries", hint: "Change status and delete" },
    ],
  },
  {
    label: "Website",
    permissions: [
      { key: "website.manage", label: "Edit website content", hint: "Contact details, bank details, notice popup" },
      { key: "catalog.manage", label: "Edit catalog lists", hint: "Makes, body types, countries, categories, currencies, auctions, expense types" },
    ],
  },
  {
    label: "Team",
    permissions: [
      { key: "users.approve", label: "Approve registrations", hint: "Approve or reject people who signed up" },
      { key: "users.manage", label: "Manage users", hint: "Create staff logins and assign roles" },
      {
        key: "users.manage_team",
        label: "Manage own team",
        hint: "Add and edit staff who report to them; new staff report to them automatically",
      },
      { key: "roles.manage", label: "Manage roles", hint: "Create roles and choose their permissions" },
    ],
  },
] as const;

export type Permission = (typeof PERMISSION_GROUPS)[number]["permissions"][number]["key"];

export type PermissionInfo = { key: Permission; label: string; hint: string };

/** Every permission with its label, in display order. */
export const PERMISSION_LIST: PermissionInfo[] = PERMISSION_GROUPS.flatMap(
  (g) => g.permissions as readonly PermissionInfo[],
);

export const ALL_PERMISSIONS: Permission[] = PERMISSION_LIST.map((p) => p.key);

export const isPermission = (key: string): key is Permission => (ALL_PERMISSIONS as string[]).includes(key);
