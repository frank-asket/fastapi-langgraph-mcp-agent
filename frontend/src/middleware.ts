import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const protectApp = createRouteMatcher(["/studio(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && protectApp(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip `/api/coach/*`: those requests are rewritten to FastAPI (see `next.config.ts`). Running Clerk
    // middleware on that path caused 500s for credentialed fetches (e.g. GET /account/subscription).
    "/((?!_next|api/coach|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
