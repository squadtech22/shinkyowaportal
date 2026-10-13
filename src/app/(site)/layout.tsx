import type { Metadata } from "next";
import { connection } from "next/server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SiteOverlays from "@/components/SiteOverlays";
import { getCurrentUser } from "@/lib/admin/auth";
import { getCurrentCustomer } from "@/lib/client/auth";
import { getSettings } from "@/lib/settings";
import { totalStock } from "@/lib/stock";

export const metadata: Metadata = {
  title: {
    template: "Shinkyowa International | %s",
    default: "Shinkyowa International | Japanese Used Car Exporter",
  },
  description:
    "Shinkyowa International exports high-quality used cars from Japan to Kenya, Tanzania, Jamaica, Bahamas, Guyana, Barbados, UK, Ireland, and Pakistan. Trustworthy service, competitive prices",
  keywords:
    "Japanese used cars for sale in Kenya, Used cars exported from Japan to Tanzania, Japanese car exporters in Jamaica, Second-hand Japanese cars for sale in UK, Used Japanese vehicles imported from Japan in Ireland, Japanese used cars for sale in Pakistan, Japanese vehicle exporters in the Bahamas, Japanese car imports in Guyana, Japanese auto exporters in Barbados, Used Japanese cars for sale in Kenya",
  icons: { icon: "/favicon.ico" },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Stock lives in MySQL and changes at any time: render every page per
  // request instead of freezing the data at build time.
  await connection();
  const [total, settings, staff, customer] = await Promise.all([
    totalStock(),
    getSettings(),
    getCurrentUser(),
    getCurrentCustomer(),
  ]);
  // Who is signed in, shown in the header instead of Login/Register. Staff
  // first: someone signed in to both is usually testing the customer portal.
  const account = staff
    ? { name: staff.name, role: staff.isSuper ? "Admin" : staff.roleName, href: "/admin" }
    : customer
      ? { name: customer.name, role: "Customer", href: "/client" }
      : null;
  return (
    <html lang="en">
      <head>
        {/* Same stylesheets, same order as the Laravel layout. Page-specific
            CSS and page-responsive.css are injected per page by <PageStyles>. */}
        {/* eslint-disable @next/next/no-css-tags -- plain files in /public, kept as-is */}
        <link rel="stylesheet" href="/css/root.css" />
        <link rel="stylesheet" href="/css/site.css" />
        <link rel="stylesheet" href="/css/vendor/swiper-bundle.min.css" />
        <link rel="stylesheet" href="https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css" />
        {/* eslint-enable @next/next/no-css-tags */}
      </head>
      <body>
        <Header total={total} settings={settings} account={account} />
        {children}
        <Footer settings={settings} />
        <SiteOverlays settings={settings} />
      </body>
    </html>
  );
}
