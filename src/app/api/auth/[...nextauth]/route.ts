import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.password) {
          return null;
        }

        const expectedPassword = process.env.APP_PASSWORD;
        if (!expectedPassword) {
          console.error("APP_PASSWORD environment variable not set");
          return null;
        }

        if (credentials.password === expectedPassword) {
          return {
            id: "1",
            name: "User",
            email: "user@pockett.app",
          };
        }

        return null;
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Always use relative URLs to avoid domain issues
      // This prevents NextAuth from redirecting to localhost
      if (url.startsWith("/")) {
        return url;
      }

      // For absolute URLs, only allow same-origin
      try {
        const urlObj = new URL(url);
        const baseUrlObj = new URL(baseUrl);
        return urlObj.origin === baseUrlObj.origin ? url : baseUrl;
      } catch {
        // If URL parsing fails, use base URL
        return baseUrl;
      }
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET || "your-secret-key-here",
});

export { handler as GET, handler as POST };
