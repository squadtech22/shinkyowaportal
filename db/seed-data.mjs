// Starting data loaded by `npm run db:setup`. Lookup tables mirror the Laravel
// seeders (same names, same order, so ids match). Vehicles are sample stock.

// [name, logo path on https://api.shinkyowa.com/]
export const makes = [
  ["Alfa Romeo", "images/makes/alfa-romeo.avif"],
  ["Toyota", "images/makes/toyota.avif"],
  ["Nissan", "images/makes/nissan.avif"],
  ["Mazda", "images/makes/mazda.avif"],
  ["Mitsubishi", "images/makes/mitsubishi.avif"],
  ["Honda", "images/makes/honda.avif"],
  ["Suzuki", "images/makes/suzuki.avif"],
  ["Subaru", "images/makes/subaru.avif"],
  ["Isuzu", "images/makes/isuzu.avif"],
  ["Daihatsu", "images/makes/daihatsu.avif"],
  ["Mitsuoka", "images/makes/mitsuoka.avif"],
  ["Lexus", "images/makes/lexus.avif"],
  ["BMW", "images/makes/BMW.avif"],
  ["Mercedes", "images/makes/mercedes.avif"],
  ["Audi", "images/makes/audi.avif"],
  ["Hino", "images/makes/hino.avif"],
  ["Volkswagen", "images/makes/volkswagon.avif"],
];

export const bodyTypes = ["Hatchback", "Sedan", "Truck", "SUV", "Van", "Pickup", "Wagon", "Buses", "Mini Buses"];

export const categories = ["New Arrival", "Discounted", "Commercial"];

export const countries = [
  "Jamaica", "Bahamas", "Guyana", "Barbados", "Kenya", "Tanzania", "Ireland", "UK", "Pakistan",
  "Mauritius", "Antigua and Barbuda",
];

// [symbol, code]
// Auction houses and cost lines for Finance (Catalog lists after the first setup).
export const auctions = [
  "USS Tokyo", "USS Yokohama", "USS Nagoya", "USS Osaka", "USS Kyushu", "USS Saitama", "USS Shizuoka", "USS Tohoku",
  "TAA Kanto", "TAA Chubu", "TAA Yokohama", "CAA Tokyo", "CAA Chubu", "CAA Gifu", "JU Gifu", "JU Chiba", "JU Fukushima",
  "ARAI Bayside", "ARAI Oyama VT", "MIRIVE Aichi", "MIRIVE Osaka", "AUCNET", "JAA", "NAA Tokyo", "ZIP Tokyo", "BAYAUC",
];

export const expenseTypes = ["Auction fees", "Freight (FWT)", "Transport", "Inspection", "Repair", "Other expense"];

export const currencies = [["$", "USD"], ["€", "EUR"], ["£", "GBP"], ["¥", "JPY"]];

const FEATURES = [
  "abs", "airbag", "power_steering", "power_windows", "air_conditioner", "navigation", "back_camera",
  "alloy_wheels", "keyless_entry", "sunroof", "leather_seats", "cruise_control",
];

const COLORS = ["white", "pearl white", "black", "silver", "grey", "blue", "red"];

// make, model, year, body type, fuel, transmission, engine cc, doors, FOB, category, country
const seeds = [
  ["Toyota", "Hilux", 2024, "Pickup", "diesel", "automatic", 2800, 4, 32500, "New Arrival", "Kenya"],
  ["Toyota", "Land Cruiser Prado", 2022, "SUV", "diesel", "automatic", 2800, 5, 41800, "New Arrival", "Jamaica"],
  ["Honda", "CR-V", 2021, "SUV", "petrol", "automatic", 1500, 5, 18900, "New Arrival", "Bahamas"],
  ["Nissan", "X-Trail", 2020, "SUV", "hybrid", "automatic", 2000, 5, 15400, "New Arrival", "Guyana"],
  ["Mazda", "CX-5", 2021, "SUV", "diesel", "automatic", 2200, 5, 17600, "New Arrival", "UK"],
  ["Toyota", "Aqua", 2019, "Hatchback", "hybrid", "automatic", 1500, 5, 7900, "New Arrival", "Kenya"],
  ["Honda", "Fit", 2020, "Hatchback", "hybrid", "automatic", 1500, 5, 8400, "New Arrival", "Ireland"],
  ["Subaru", "Forester", 2019, "SUV", "petrol", "automatic", 2500, 5, 12800, "New Arrival", "Barbados"],
  ["Lexus", "RX450h", 2020, "SUV", "hybrid", "automatic", 3500, 5, 38900, "New Arrival", "Pakistan"],
  ["Mercedes", "C200", 2019, "Sedan", "petrol", "automatic", 2000, 4, 21500, "New Arrival", "UK"],
  ["Toyota", "Corolla Axio", 2018, "Sedan", "hybrid", "automatic", 1500, 4, 0, "New Arrival", "Tanzania"],
  ["Suzuki", "Swift", 2020, "Hatchback", "petrol", "manual", 1200, 5, 6900, "New Arrival", "Mauritius"],
  ["Mitsubishi", "Outlander", 2019, "SUV", "petrol", "automatic", 2400, 5, 11200, "New Arrival", "Jamaica"],
  ["Toyota", "Vitz", 2017, "Hatchback", "petrol", "automatic", 1000, 5, 4800, "Discounted", "Kenya"],
  ["Nissan", "Note", 2018, "Hatchback", "hybrid", "automatic", 1200, 5, 5200, "Discounted", "Tanzania"],
  ["Honda", "Vezel", 2018, "SUV", "hybrid", "automatic", 1500, 5, 9800, "Discounted", "Guyana"],
  ["Mazda", "Demio", 2017, "Hatchback", "diesel", "automatic", 1500, 5, 4900, "Discounted", "Jamaica"],
  ["Toyota", "Prius", 2017, "Hatchback", "hybrid", "automatic", 1800, 5, 7600, "Discounted", "Bahamas"],
  ["Subaru", "Impreza", 2018, "Sedan", "petrol", "automatic", 2000, 4, 6800, "Discounted", "Barbados"],
  ["Daihatsu", "Move", 2019, "Hatchback", "petrol", "automatic", 660, 5, 3900, "Discounted", "Antigua and Barbuda"],
  ["Volkswagen", "Golf", 2017, "Hatchback", "petrol", "automatic", 1400, 5, 7200, "Discounted", "Ireland"],
  ["BMW", "320i", 2017, "Sedan", "petrol", "automatic", 2000, 4, 11900, "Discounted", "UK"],
  ["Audi", "A4", 2016, "Sedan", "petrol", "automatic", 2000, 4, 10400, "Discounted", "Ireland"],
  ["Toyota", "Wish", 2016, "Wagon", "petrol", "automatic", 1800, 5, 5600, "Discounted", "Kenya"],
  ["Nissan", "Juke", 2017, "SUV", "petrol", "automatic", 1500, 5, 6300, "Discounted", "Pakistan"],
  ["Mitsuoka", "Viewt", 2018, "Sedan", "petrol", "automatic", 1200, 4, 0, "Discounted", "UK"],
  ["Toyota", "Hiace", 2019, "Van", "diesel", "manual", 2800, 5, 22800, "Commercial", "Kenya"],
  ["Nissan", "NV350 Caravan", 2018, "Van", "diesel", "automatic", 2500, 5, 15600, "Commercial", "Tanzania"],
  ["Isuzu", "Elf", 2017, "Truck", "diesel", "manual", 3000, 2, 17900, "Commercial", "Jamaica"],
  ["Hino", "Dutro", 2016, "Truck", "diesel", "manual", 4000, 2, 16400, "Commercial", "Guyana"],
  ["Mitsubishi", "Canter", 2018, "Truck", "diesel", "manual", 3000, 2, 18200, "Commercial", "Kenya"],
  ["Toyota", "Coaster", 2015, "Buses", "diesel", "manual", 4000, 2, 29500, "Commercial", "Tanzania"],
  ["Nissan", "Civilian", 2014, "Mini Buses", "diesel", "manual", 4500, 2, 21000, "Commercial", "Barbados"],
  ["Isuzu", "D-Max", 2020, "Pickup", "diesel", "manual", 3000, 4, 19800, "Commercial", "Bahamas"],
  ["Nissan", "Navara", 2019, "Pickup", "diesel", "automatic", 2500, 4, 17200, "Commercial", "UK"],
  ["Mazda", "Bongo", 2018, "Van", "petrol", "manual", 1800, 5, 8100, "Commercial", "Mauritius"],
  ["Suzuki", "Carry", 2019, "Truck", "petrol", "manual", 660, 2, 4600, "Commercial", "Pakistan"],
  ["Toyota", "Probox", 2018, "Wagon", "petrol", "automatic", 1500, 5, 5900, "Commercial", "Kenya"],
  ["Honda", "Accord", 2019, "Sedan", "hybrid", "automatic", 2000, 4, 14200, "New Arrival", "Antigua and Barbuda"],
  ["Alfa Romeo", "Giulietta", 2017, "Hatchback", "petrol", "automatic", 1400, 5, 9300, "Discounted", "Ireland"],
  ["Toyota", "Alphard", 2020, "Van", "hybrid", "automatic", 2500, 5, 36700, "New Arrival", "Pakistan"],
  ["Mercedes", "GLC 220d", 2020, "SUV", "diesel", "automatic", 2200, 5, 34200, "New Arrival", "UK"],
];

const placeholder = (text, bg = "11254A") =>
  `https://placehold.co/600x400/${bg}/ffffff/png?text=${encodeURIComponent(text)}`;

export const vehicles = seeds.map((s, i) => {
  const [make, model, year, bodyType, fuel, transmission, engine, doors, fob, category, country] = s;
  const n = i + 1;
  const label = `${make} ${model}`;
  const prefix = model.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "SKI";
  return {
    sid: String(1000 + n * 7),
    thumbnail: placeholder(label),
    images: [placeholder(`${label} - Front`, "1E1E1E"), placeholder(`${label} - Interior`, "8C1823"), placeholder(`${label} - Rear`, "1E1E1E")],
    chassis: `${prefix}${String(100000 + ((n * 7919) % 899999)).padStart(7, "0")}`,
    make,
    model,
    year: String(year),
    fob,
    currency: country === "UK" ? "GBP" : country === "Ireland" ? "EUR" : "USD",
    mileage: String(18000 + ((n * 15373) % 140000)),
    doors: String(doors),
    transmission,
    bodyType,
    fuel,
    category,
    country,
    engine,
    color: COLORS[n % COLORS.length],
    features: FEATURES.filter((_, f) => (n + f) % 3 !== 0).slice(0, 4 + (n % 7)),
  };
});

// settings: [key, value]. Inserted only when the key is missing, so edits made
// in the database are never overwritten by `npm run db:setup`.
export const settings = [
  ["email", "info@shinkyowa.com"],
  ["phones", "+81 70-1524-1308, +81 70-7427-0468"], // comma-separated; the first is the main number
  ["whatsapp_number", "817074270468"], // digits only, used for https://wa.me/<number>
  ["facebook_url", "https://www.facebook.com/shinkyowaint"],
  ["linkedin_url", "https://www.linkedin.com/company/shin-kyowa-international"],
  ["instagram_url", "https://www.instagram.com/shinkyowainternational"],
  ["head_office_address", "Gunma ken Maebashi shi Komagata Machi 150-2"],
  ["head_office_post_code", "379-2122"],
  ["head_office_tel_fax", "+8127 212 9973, +8127 212 9986"],
  ["toyama_office_address", "Toyama ken Imizu shi Inazumi 786-2"],
  ["toyama_office_post_code", "939-0301"],
  ["toyama_office_tel_fax", "0766 555 081"],
  ["office_hours", "Mon - Fri : 09am to 06pm"],
  ["notice_enabled", "1"], // "1" shows the popup on page load, "0" hides it
  ["notice_title", "POSSIBLE SHIPPING DELAYS – Updated April 3, 2026"],
  [
    "notice_body",
    "Ongoing developments in the Middle East may result in delays to certain ocean freight shipments. At this time, the specific regions and expected timeframes affected have not been fully determined; however, vehicle delivery schedules may be subject to change. We are actively coordinating with our shipping partners and will continue to share updates as new information becomes available.",
  ],
];

// info_rows: section -> [label, value] in display order.
export const infoRows = {
  bank_details: [
    ["Bank Name", "SUMITOMO MITSUI BANKING CORPORATION"],
    ["Branch", "TOYAMA BRANCH"],
    ["Address", "1 CHOME -23 CHUODORI TOYAMA, 930-00 JAPAN"],
    ["Swift Code", "S M B C J P J T"],
    ["Account No", "ORDINARY A/C NO. 1027847"],
    ["Account Holder", "SHINKYOWAINTERNATIONAL Co. LTD"],
  ],
  company_profile: [
    ["Company Name", "SHINKYOWA International Co. Ltd"],
    ["Head Office", "Gunma ken Maebashi shi Komagata Machi 150-2"],
    ["Phone Number", "+8127 212 9973"],
    ["Fax Number", "+8127 212 9986"],
    ["Business Description", "Export and sale of automobiles"],
  ],
};

// Default roles. Super Admin always has every permission (is_super); the
// others start with these permission keys (see src/lib/admin/permissions.ts)
// and can be changed, or new roles added, from Admin > Roles.
export const roles = [
  { name: "Super Admin", description: "Full access to everything, including users and roles.", isSuper: true, permissions: [] },
  {
    name: "Manager",
    description: "Runs sales: all customers, stock, payments and website content.",
    isSuper: false,
    permissions: [
      "dashboard.view", "stock.view", "stock.manage", "customers.view", "customers.manage", "customers.view_all",
      "payments.view", "payments.manage", "inquiries.view", "inquiries.manage",
      "website.manage", "catalog.manage", "users.approve", "users.manage_team", "shipments.view", "shipments.manage",
      "shipments.status", "documents.view", "documents.manage",
    ],
  },
  {
    name: "Team Leader",
    description: "Leads a team of agents: their own and their team's customers, shipments and documents.",
    isSuper: false,
    permissions: [
      "dashboard.view", "stock.view", "stock.add", "customers.view", "customers.manage", "customers.view_team", "payments.view",
      "payments.manage", "inquiries.view", "shipments.view", "shipments.manage", "shipments.status", "documents.view",
      "documents.manage",
    ],
  },
  {
    name: "Finance Manager",
    description: "Pays approved staff commission; sees costs, profit and Japan payments.",
    isSuper: false,
    permissions: ["dashboard.view", "payments.view", "finance.view", "finance.manage", "commission.pay"],
  },
  {
    name: "Agent",
    description: "Sales agent: own customers and their payments; adds vehicles to stock but not to the website.",
    isSuper: false,
    permissions: [
      "dashboard.view", "stock.view", "stock.add", "customers.view", "customers.manage", "payments.view", "payments.manage",
      "inquiries.view", "shipments.view", "shipments.manage", "shipments.status", "documents.view", "documents.manage",
    ],
  },
];
