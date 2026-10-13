// Shared types and constants. Safe to import from client components; all
// actual data lives in MySQL and is read through src/lib/stock.ts.

// Make logos, flags, body-type icons, banners and offers.
export const IMAGE_API_URL = "https://api.shinkyowa.com/";
// Uploaded vehicle photos (stocks.thumbnail / stocks.images hold paths relative to this).
export const STOCK_IMG_URL = "https://crm.shinkyowa.com/storage/";

export type Currency = { symbol: string; code: string };

export type Vehicle = {
  id: number;
  sid: number;
  thumbnail: string;
  images: string[];
  chassis: string;
  make: string;
  model: string;
  year: number;
  fob: number;
  currency: Currency;
  mileage: number;
  doors: number;
  transmission: string;
  bodyType: string;
  fuel: string;
  category: string;
  country: string;
  engine: number;
  color: string;
  features: string[];
};

/** A make, body type or country tile in the left sidebar. */
export type SidebarEntry = { name: string; href: string; img: string; count: number };

export type Country = { id: number; name: string };

type Office = { address: string; postCode: string; telFax: string };

/** Site-wide details from the `settings` table (see src/lib/settings.ts). */
export type SiteSettings = {
  email: string;
  /** First entry is the main number (mobile menu, footer call button). */
  phones: string[];
  whatsappNumber: string;
  facebookUrl: string;
  linkedinUrl: string;
  instagramUrl: string;
  headOffice: Office;
  toyamaOffice: Office;
  officeHours: string;
  notice: { enabled: boolean; title: string; body: string };
};
