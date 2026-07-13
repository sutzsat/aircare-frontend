import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export -- this build ships to S3 + served via CloudFront
  // (Phase 14 infra), which serves plain files, not server-rendered pages.
  output: "export",
  images: { unoptimized: true }, // next/image optimization needs a server; not used here anyway
};

export default nextConfig;
