import { clerkFrontendApiOrigin, isClerkSameOriginFapiProxyEnabled } from "@/lib/clerkFapiProxy";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

function proxyConfigured(): boolean {
  const fixed = process.env.NEXT_PUBLIC_CLERK_PROXY_URL?.trim();
  if (fixed && fixed !== "0" && fixed.toLowerCase() !== "false") return true;
  return isClerkSameOriginFapiProxyEnabled();
}

function buildTargetUrl(request: NextRequest, pathSegments: string[] | undefined): URL {
  const path = pathSegments?.length ? pathSegments.join("/") : "";
  const origin = clerkFrontendApiOrigin();
  const url = new URL(path ? `/${path}` : "/", origin);
  url.search = new URL(request.url).search;
  return url;
}

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "127.0.0.1"
  );
}

async function proxy(request: NextRequest, pathSegments: string[] | undefined): Promise<Response> {
  if (!proxyConfigured()) {
    return NextResponse.json({ error: "Clerk FAPI proxy is not enabled" }, { status: 404 });
  }

  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ error: "CLERK_SECRET_KEY missing" }, { status: 500 });
  }

  const targetUrl = buildTargetUrl(request, pathSegments);
  const proxyBase = new URL("/__clerk/", request.url).href;

  const forward = new Headers();
  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower) || lower === "host") return;
    forward.set(key, value);
  });

  forward.set("Host", new URL(clerkFrontendApiOrigin()).host);
  forward.set("Clerk-Proxy-Url", proxyBase);
  forward.set("Clerk-Secret-Key", secret);
  forward.set("X-Forwarded-For", clientIp(request));

  const init: RequestInit = {
    method: request.method,
    headers: forward,
    redirect: "follow",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    Object.assign(init, { duplex: "half" as const });
  }

  const upstream = await fetch(targetUrl, init);

  const out = new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
  });

  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === "content-encoding" || lower === "transfer-encoding") return;
    out.headers.append(key, value);
  });

  return out;
}

type RouteCtx = { params: Promise<{ path?: string[] }> };

export async function GET(request: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export async function PUT(request: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export async function DELETE(request: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export async function OPTIONS(request: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export async function HEAD(request: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}
