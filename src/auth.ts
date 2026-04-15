import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  debug: true,
  useSecureCookies: true,
  providers: [
    Credentials({
      credentials: {
        phone: { label: "Phone", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const url = `${process.env.PP_SKETCH_INTERNAL_URL}/users/login`;
        console.log(`[auth] authorize START phone=${credentials.phone} url=${url}`);
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
          const result = { id: user.id, name: user.external_id, role: user.role };
          console.log(`[auth] authorize SUCCESS returning:`, JSON.stringify(result));
          return result;
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
    jwt({ token, user, trigger }) {
      console.log(`[auth] jwt callback trigger=${trigger} hasUser=${!!user} token.sub=${token.sub}`);
      if (user) {
        token.role = (user as { role: string }).role;
        token.external_id = user.name ?? undefined;
        console.log(`[auth] jwt callback SET role=${token.role} external_id=${token.external_id}`);
      }
      return token;
    },
    session({ session, token }) {
      console.log(`[auth] session callback token.sub=${token.sub} token.role=${token.role}`);
      session.user.role = token.role as string;
      session.user.external_id = token.external_id as string;
      return session;
    },
  },
});
