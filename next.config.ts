import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
