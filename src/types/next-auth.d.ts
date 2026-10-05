import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "STUDENT" | "ADMIN";
      accessTier: "FREE" | "PREMIUM";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "STUDENT" | "ADMIN";
    accessTier?: "FREE" | "PREMIUM";
  }
}