import "server-only";
import { headers } from "next/headers";

/** Visitor IP, as Laravel's $request->getClientIp() recorded it for inquiries. */
export async function clientIp() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || h.get("x-real-ip") || "127.0.0.1").slice(0, 45);
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
