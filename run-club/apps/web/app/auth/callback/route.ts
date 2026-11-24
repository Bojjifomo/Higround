import { NextResponse, type NextRequest } from "next/server";
import { siteUrl } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

/** Origin as the visitor sees it (NEXT_PUBLIC_SITE_URL, else the Host header); the request URL may say localhost. */
function originOf(req: Request): string {
  return siteUrl(req.headers.get("x-forwarded-host") ?? req.headers.get("host"), req.headers.get("x-forwarded-proto"));
}

/** Supabase Auth lands here after the magic link or Google: swap the code for a session. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origin = originOf(req);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (!code) return NextResponse.redirect(new URL("/login?error=link", origin));
  const { error } = await (await createClient()).auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=link", origin));
  return NextResponse.redirect(new URL(safe === "/" ? "/onboarding" : safe, origin));
}
