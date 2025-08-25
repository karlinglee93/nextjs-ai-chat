import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnChatBox = nextUrl.pathname === "/";

      console.info(`🔧 Middle ware: logged in: ${isLoggedIn}; on chatbox oage: ${isOnChatBox}`)

      if (isLoggedIn) {
        if (isOnChatBox) return true;
        return Response.redirect(new URL("/", nextUrl));
      }

      return false;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
