import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        phone: { label: "Phone", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const url = `${process.env.PP_SKETCH_INTERNAL_URL}/users/login`;
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: credentials.phone,
              password: credentials.password,
            }),
          });
          if (!res.ok) {
            const body = await res.text();
            console.error(`[auth] authorize FAILED status=${res.status} body=${body}`);
            return null;
          }
          const user = await res.json();
          return { id: user.id, name: user.external_id, role: user.role };
        } catch (err) {
          console.error(`[auth] authorize FETCH_ERROR:`, err);
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role;
        token.external_id = user.name ?? undefined;
      }
      return token;
    },
    session({ session, token }) {
      session.user.role = token.role as string;
      session.user.external_id = token.external_id as string;
      return session;
    },
  },
});
