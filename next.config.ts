import type { NextConfig } from "next";

const exposeTestingApi = process.env.EXPOSE_TESTING_API === "1";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.10.226"],
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.matas.dk" },
      { protocol: "https", hostname: "static.thcdn.com" },
      { protocol: "https", hostname: "cdn.grupoelcorteingles.es" },
      { protocol: "https", hostname: "labelleperfumes.com" },
      { protocol: "https", hostname: "assets.armani.com" },
    ],
  },
  experimental: {
    exposeTestingApiInProductionBuild: exposeTestingApi,
  },
};

export default nextConfig;
