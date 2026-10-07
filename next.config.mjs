const prismaPackages = ["@prisma/client", ".prisma/client"];

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    ...prismaPackages,
    // OpenNext matches these names against file paths, which use backslashes when building on Windows.
    ...prismaPackages.map((name) => name.replace("/", "\\")),
  ],
};

export default nextConfig;
