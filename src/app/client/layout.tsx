import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../admin/admin.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { template: "%s · Shinkyowa Customer Portal", default: "Shinkyowa Customer Portal" },
  robots: { index: false, follow: false },
};

// Root layout of the customer portal: buyers see their vehicles, shipments,
// export documents, payments and loyalty points. Uses the admin panel's
// Tailwind theme, but none of its navigation.
export default function ClientRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} scroll-smooth`}>
      <body className="min-h-screen bg-slate-100/70 font-sans text-slate-900 antialiased">{children}</body>
    </html>
  );
}
