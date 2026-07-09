import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server build for the Docker/Fly deployment. public/ and
  // .next/static are copied in by the Dockerfile per the self-hosting guide.
  output: 'standalone',
};

export default nextConfig;
