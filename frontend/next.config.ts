import type { NextConfig } from "next";

function staticImageRemotePatterns(): NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]> {
  const patterns: NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]> = [
    { protocol: "http", hostname: "127.0.0.1", port: "8000", pathname: "/static/**" },
    { protocol: "http", hostname: "localhost", port: "8000", pathname: "/static/**" },
  ];
  const base = (process.env.NEXT_PUBLIC_API_URL || "").trim();
  if (!base) return patterns;
  try {
    const u = new URL(base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return patterns;
    const protocol = u.protocol === "https:" ? "https" : "http";
    const entry: (typeof patterns)[number] = {
      protocol,
      hostname: u.hostname,
      pathname: "/static/**",
    };
    if (u.port) entry.port = u.port;
    patterns.push(entry);
  } catch {
    /* invalid NEXT_PUBLIC_API_URL */
  }
  return patterns;
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: staticImageRemotePatterns(),
  },
};

export default nextConfig;
