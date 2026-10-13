import { readUpload } from "@/lib/uploads";

// Public vehicle photos uploaded from the admin panel: /uploads/stock/<name>.
export async function GET(_req: Request, ctx: RouteContext<"/uploads/[...path]">) {
  const { path } = await ctx.params;
  if (path[0] !== "stock" || path.length !== 2) return new Response("Not found", { status: 404 });
  const file = await readUpload(path.join("/"), "stock");
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.type,
      // Names are random and never reused, so the file can be cached forever.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
