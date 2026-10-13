import "server-only";
import { cookies } from "next/headers";

// One-shot toast message shown after a redirect (e.g. "Vehicle saved").
// Not httpOnly: the <Toast> client component reads and clears it.
export const FLASH_COOKIE = "skw_flash";

export type Flash = { type: "success" | "error"; message: string };

export async function setFlash(message: string, type: Flash["type"] = "success") {
  (await cookies()).set(FLASH_COOKIE, encodeURIComponent(JSON.stringify({ type, message })), {
    path: "/admin",
    maxAge: 30,
    sameSite: "lax",
  });
}
