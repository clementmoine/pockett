import NextAuth from "next-auth";

// Extend the built-in session types
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

export const { auth, signIn, signOut } = NextAuth({
  providers: [],
  secret: process.env.NEXTAUTH_SECRET || "your-secret-key-here",
});
