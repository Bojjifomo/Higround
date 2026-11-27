import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { currentMember, siteUrl } from "@/lib/data";
import { getProvider } from "@/lib/providers";

/** Origin as the visitor sees it (NEXT_PUBLIC_SITE_URL, else the Host header); the request URL may say localhost. */
function originOf(req: Request): string {
  return siteUrl(req.headers.get("x-forwarded-host") ?? req.headers.get("host"), req.headers.get("x-forwarded-proto"));
}

function safeNext(v: string | null): string | null {
  return v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : null;
}

/** Start the Intervals.icu OAuth flow (state + PKCE + optional return paths kept in short-lived httpOnly cookies). */
export async function GET(req: Request) {
  const origin = originOf(req);
  const me = await currentMember();
  if (!me) return NextResponse.redirect(new URL("/login", origin));
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));
  const from = safeNext(url.searchParams.get("from"));
  const state = randomBytes(18).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const jar = await cookies();
  const opts = { httpOnly: true, sameSite: "lax" as const, path: "/api/intervals", maxAge: 600, secure: origin.startsWith("https") };
  jar.set("hg_iv_state", state, opts);
  jar.set("hg_iv_verifier", verifier, opts);
  if (next) jar.set("hg_iv_next", next, opts);
  else jar.delete({ name: "hg_iv_next", path: "/api/intervals" });
  if (from) jar.set("hg_iv_from", from, opts);
  else jar.delete({ name: "hg_iv_from", path: "/api/intervals" });
  try {
    const target = getProvider().authorizeUrl(state, challenge);
    return NextResponse.redirect(new URL(target, origin));
  } catch (e) {
    console.error("intervals authorizeUrl failed:", (e as Error).message);
    const errDest = new URL(from ?? `/u/${me.handle}`, origin);
    errDest.searchParams.set("intervals", "config_error");
    return NextResponse.redirect(errDest);
  }
}
