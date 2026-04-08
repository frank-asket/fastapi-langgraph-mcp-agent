import { headers } from "next/headers";
import { parsePublishableKey } from "@clerk/shared/keys";

export const CLERK_PROXY_PATH = "/__clerk";

/** Subresource requests to a separate Frontend API host (e.g. clerk.*) often fail CORS under Cloudflare; proxying via same origin fixes that. */
export function isClerkSameOriginFapiProxyEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_CLERK_USE_SAME_ORIGIN_FAPI_PROXY?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** ClerkProvider / handshake: absolute URL to the app’s proxy prefix (trailing slash). */
export async function clerkProxyUrlForRequest(): Promise<string | undefined> {
  const fixed = process.env.NEXT_PUBLIC_CLERK_PROXY_URL?.trim();
  if (fixed && fixed !== "0" && fixed.toLowerCase() !== "false") {
    return fixed.endsWith("/") ? fixed : `${fixed}/`;
  }
  if (!isClerkSameOriginFapiProxyEnabled()) {
    return undefined;
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return undefined;
  const protoHeader = h.get("x-forwarded-proto");
  const proto =
    protoHeader === "http" || protoHeader === "https"
      ? protoHeader
      : process.env.VERCEL === "1"
        ? "https"
        : "http";
  return `${proto}://${host}${CLERK_PROXY_PATH}/`;
}

export function clerkFrontendApiOrigin(): string {
  const override = process.env.CLERK_FRONTEND_API_URL?.trim().replace(/\/$/, "");
  if (override) return override;
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!pk) throw new Error("Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  const parsed = parsePublishableKey(pk);
  const host = parsed?.frontendApi?.replace(/\$/g, "");
  if (!host) throw new Error("Invalid Clerk publishable key (frontend API host)");
  return `https://${host}`;
}

/** Same rules as {@link clerkProxyUrlForRequest}, for Edge middleware (no `headers()`). */
export function clerkProxyUrlFromRequest(req: Request): string | undefined {
  const fixed = process.env.NEXT_PUBLIC_CLERK_PROXY_URL?.trim();
  if (fixed && fixed !== "0" && fixed.toLowerCase() !== "false") {
    return fixed.endsWith("/") ? fixed : `${fixed}/`;
  }
  if (isClerkSameOriginFapiProxyEnabled()) {
    return new URL(`${CLERK_PROXY_PATH}/`, req.url).href;
  }
  return undefined;
}
