// Lookup tables editable under Catalog lists. `usage` lists the places that
// reference a row, so in-use rows cannot be deleted (their foreign keys
// would otherwise silently become NULL).

export type CatalogColumn = { key: string; label: string; max: number; hint?: string; required?: boolean };

export const CATALOG = {
  makes: {
    title: "Makes",
    description: "Brands in the sidebar, filters and vehicle form.",
    columns: [
      { key: "name", label: "Name", max: 100, required: true },
      {
        key: "image",
        label: "Logo",
        max: 255,
        hint: "Path on api.shinkyowa.com (e.g. images/makes/toyota.avif) or a full URL",
      },
    ],
    usage: [{ table: "stocks", column: "make_id", label: "vehicles" }],
  },
  body_types: {
    title: "Body types",
    description: "“Search by type” and the vehicle form.",
    columns: [{ key: "name", label: "Name", max: 100, required: true }],
    usage: [{ table: "stocks", column: "body_type_id", label: "vehicles" }],
  },
  categories: {
    title: "Categories",
    description: "Home page sections (New Arrival, Discounted, Commercial).",
    columns: [{ key: "name", label: "Name", max: 100, required: true }],
    usage: [{ table: "stocks", column: "category_id", label: "vehicles" }],
  },
  countries: {
    title: "Countries",
    description: "Stock countries, customer countries and enquiry destinations.",
    columns: [{ key: "name", label: "Name", max: 100, required: true }],
    usage: [
      { table: "stocks", column: "country_id", label: "vehicles" },
      { table: "customer_accounts", column: "country_id", label: "customers" },
      { table: "inquiries", column: "country_id", label: "enquiries" },
    ],
  },
  currencies: {
    title: "Currencies",
    description: "Vehicle prices and customer accounts.",
    columns: [
      { key: "code", label: "Code", max: 4, required: true, hint: "e.g. USD" },
      { key: "symbol", label: "Symbol", max: 1, required: true, hint: "One character, e.g. $" },
    ],
    usage: [
      { table: "stocks", column: "currency_id", label: "vehicles" },
      { table: "customer_accounts", column: "currency_id", label: "customers" },
    ],
  },
  auctions: {
    title: "Auctions",
    description: "Auction houses on the vehicle purchase form (Finance).",
    columns: [{ key: "name", label: "Name", max: 100, required: true }],
    usage: [{ table: "stock_purchases", column: "auction_id", label: "purchases" }],
  },
  expense_types: {
    title: "Expense types",
    description: "Cost lines on the vehicle purchase form (Finance), added to the bought price.",
    columns: [{ key: "name", label: "Name", max: 100, required: true }],
    usage: [{ table: "stock_expenses", column: "expense_type_id", label: "vehicle costs" }],
  },
} satisfies Record<
  string,
  {
    title: string;
    description: string;
    columns: CatalogColumn[];
    usage: { table: string; column: string; label: string }[];
  }
>;

export type CatalogTable = keyof typeof CATALOG;

export const isCatalogTable = (t: string): t is CatalogTable => t in CATALOG;
