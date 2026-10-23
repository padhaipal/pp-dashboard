import type { NextConfig } from "next";

const OLD_HOST = "dashboard.padhaipal.com";
const NEW_HOST = "dashboard.lifteracy.ai";

const nextConfig: NextConfig = {
  // dashboard.padhaipal.com → dashboard.lifteracy.ai (2026-10): pages move
  // permanently, path + query kept, so WhatsApp links already sent still land.
  // /api stays on both hosts (a cross-origin redirect would break POSTs).
  async redirects() {
    return [
      {
        source: "/:path((?!api/).*)",
        has: [{ type: "host", value: OLD_HOST }],
        destination: `https://${NEW_HOST}/:path`,
        permanent: true,
      },
    ];
  },
  // the donor page's policies at plain URLs (the PDFs live in public/legal)
  async rewrites() {
    return [
      { source: "/privacy", destination: "/legal/privacy-policy.pdf" },
      { source: "/terms", destination: "/legal/terms-of-use.pdf" },
      { source: "/child-protection", destination: "/legal/child-protection-policy.pdf" },
    ];
  },
};

export default nextConfig;
