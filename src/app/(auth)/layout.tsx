import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../admin/admin.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { template: "%s · Shinkyowa International", default: "Shinkyowa International" },
  robots: { index: false, follow: false },
};

// Root layout of the shared sign-in (/login) for staff and customers. Uses
// the admin panel's Tailwind theme, like the customer portal.
export default function AuthRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-slate-100/70 font-sans text-slate-900 antialiased">{children}</body>
    </html>
  );
}
