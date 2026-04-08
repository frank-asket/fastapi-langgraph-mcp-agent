import { clerkProxyUrlFromRequest } from "@/lib/clerkFapiProxy";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

const protectApp = createRouteMatcher(["/studio(.*)"]);

/** Same-origin auth pages — avoids Clerk Account Portal hostnames (e.g. sign-in.example.com) that may be NXDOMAIN until DNS is ready. */
const embeddedSignIn = "/sign-in";
const embeddedSignUp = "/sign-up";

function absoluteAuthPath(req: NextRequest, path: string): string {
  return new URL(path, req.url).href;
}

export default clerkMiddleware(
  async (auth, req) => {
    if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && protectApp(req)) {
      await auth.protect({
        unauthenticatedUrl: absoluteAuthPath(req, embeddedSignIn),
      });
    }
  },
  (req) => {
    const base = {
      signInUrl: absoluteAuthPath(req, embeddedSignIn),
      signUpUrl: absoluteAuthPath(req, embeddedSignUp),
    };
    const proxyUrl = clerkProxyUrlFromRequest(req);
    return proxyUrl ? { ...base, proxyUrl } : base;
  },
);

export const config = {
  matcher: [
    // Skip `/api/coach/*`: those requests are rewritten to FastAPI (see `next.config.ts`). Running Clerk
    // middleware on that path caused 500s for credentialed fetches (e.g. GET /account/subscription).
    "/((?!_next|api/coach|__clerk|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
