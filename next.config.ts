import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["1pbqn6o281.preview.c37.airoapp.ai"],
  // Cache Components keeps visited routes mounted (hidden) during navigation.
  // Each page injects its own stylesheet from the original site, so hidden
  // routes would leak their CSS into the visible page. Keep it off.
  cacheComponents: false,
  experimental: {
    // The public site and the admin panel have separate root layouts, so a
    // 404 for unmatched URLs comes from src/app/global-not-found.tsx.
    globalNotFound: true,
    serverActions: {
      // Admin forms upload vehicle photos and TT copies (8 MB each max,
      // see src/lib/uploads.ts).
      bodySizeLimit: "40mb",
    },
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
