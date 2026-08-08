import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/api") || pathname.startsWith("/_next") || pathname.includes(".")) return NextResponse.next();
  if (pathname === "/" || (!pathname.startsWith("/en") && !pathname.startsWith("/ko"))) {
    const url = request.nextUrl.clone();
    url.pathname = `/en${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }
  const localeMatch = pathname.match(/^\/(en|ko)(\/.*)?$/);
  if (localeMatch) {
    const locale = localeMatch[1];
    const url = request.nextUrl.clone();
    url.pathname = localeMatch[2] || "/";
    url.searchParams.set("locale", locale);
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
