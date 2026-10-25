import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, PRIVATE_CACHE, safeAccessNext, validAccessToken } from "./lib/site-access";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // Installation metadata contains no credentials. Whitelist exact files only;
  // the engine, room APIs, image optimization and RSC remain protected.
  const installAsset = ["/manifest.webmanifest", "/favicon.svg",
    "/app-icons/icon-192.png", "/app-icons/icon-512.png",
    "/app-icons/maskable-512.png", "/app-icons/apple-touch-icon.png"].includes(path);
  if (path.startsWith("/_next/static/") || installAsset && ["GET", "HEAD"].includes(request.method)) return NextResponse.next();
  let response: NextResponse;
  if (path === "/access" || path === "/api/access" || validAccessToken(request.cookies.get(ACCESS_COOKIE)?.value)) {
    response = NextResponse.next();
  } else if (path.startsWith("/api/") || !["GET", "HEAD"].includes(request.method)) {
    response = NextResponse.json({ error: "請先輸入網站密碼。" }, { status: 401 });
  } else {
    const url = request.nextUrl.clone();
    url.pathname = "/access";
    url.search = "";
    url.searchParams.set("next", safeAccessNext(path + request.nextUrl.search));
    response = NextResponse.redirect(url, 307);
  }
  response.headers.set("Cache-Control", PRIVATE_CACHE);
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = { matcher: "/:path*" };
