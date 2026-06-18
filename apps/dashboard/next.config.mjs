/** @type {import("next").NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.discordapp.com"
      }
    ]
  },
  transpilePackages: ["@guildforge/config", "@guildforge/database", "@guildforge/shared"]
};

export default nextConfig;
