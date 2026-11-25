import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Keeps the Supabase session cookie fresh. Does nothing in demo mode (no Supabase env). */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  // Supabase falls back to the Site URL ("/?code=…") when the redirect URL is not on its allow list.
  // Send such a code on to the callback so the login still completes.
  const code = request.nextUrl.searchParams.get("code");
  if (code && request.nextUrl.pathname !== "/auth/callback" && !request.nextUrl.pathname.startsWith("/api/")) {
    const dest = new URL("/auth/callback", publicOrigin(request));
    dest.searchParams.set("code", code);
    return NextResponse.redirect(dest);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (all) => {
        all.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        all.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

/** The origin the visitor sees: NEXT_PUBLIC_SITE_URL, else the forwarded host (behind Tailscale Funnel the request URL says localhost). */
function publicOrigin(request: NextRequest): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (site) return site;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/intervals/webhook|api/cron).*)"],
};
