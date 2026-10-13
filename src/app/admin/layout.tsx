import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getCurrentUser } from "@/lib/admin/auth";
import "./admin.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { template: "%s · Shinkyowa Admin", default: "Shinkyowa Admin" },
  robots: { index: false, follow: false },
};

// Root layout of the admin panel. Separate from the public site's root layout
// (src/app/(site)/layout.tsx), so neither one's CSS reaches the other.
// data-theme is the signed-in user's light/dark choice (see admin.css).
export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en" className={inter.variable} data-theme={user?.theme ?? "light"}>
      <body className="min-h-screen bg-slate-100/70 font-sans text-slate-900 antialiased">{children}</body>
    </html>
  );
}
