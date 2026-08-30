import type { NextConfig } from "next";

// Static export is a load-bearing choice, not a preference: Airlock's claim is that no
// data leaves the device, and the absence of any server runtime is what makes that
// verifiable rather than promised. See docs/adr/0002-nextjs-static-export.md.
const nextConfig: NextConfig = {
  output: "export",
};

export default nextConfig;
