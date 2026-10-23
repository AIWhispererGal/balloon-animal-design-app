import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Everything runs in the browser, so the app ships as plain static files (out/).
  output: "export",
};

export default nextConfig;
