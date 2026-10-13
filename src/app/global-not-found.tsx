import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page Not Found | Shinkyowa International",
};

// Served for URLs that match no route. It renders outside both root layouts
// (public site and admin), so it carries its own minimal styling.
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Roboto, Arial, sans-serif",
          background: "#f5f6f8",
          color: "#1E1E1E",
        }}
      >
        <main style={{ textAlign: "center", padding: 24 }}>
          <p style={{ fontSize: 72, fontWeight: 700, margin: 0, color: "#11254A" }}>404</p>
          <h1 style={{ fontSize: 22, margin: "8px 0 12px" }}>Page not found</h1>
          <p style={{ margin: "0 0 24px", color: "#555" }}>The page you are looking for does not exist.</p>
          <Link
            href="/"
            style={{
              display: "inline-block",
              padding: "10px 22px",
              background: "#8C1823",
              color: "white",
              textDecoration: "none",
              borderRadius: 4,
            }}
          >
            Back to home
          </Link>
        </main>
      </body>
    </html>
  );
}
