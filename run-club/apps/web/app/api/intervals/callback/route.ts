import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { connectIntervals, currentMember, getStore, siteUrl, syncMember } from "@/lib/data";
import { getProvider, ProviderAuthError, ProviderError } from "@/lib/providers";

/** Origin as the visitor sees it (NEXT_PUBLIC_SITE_URL, else the Host header); the request URL may say localhost. */
function originOf(req: Request): string {
  return siteUrl(req.headers.get("x-forwarded-host") ?? req.headers.get("host"), req.headers.get("x-forwarded-proto"));
}

function safeNext(v: string | undefined): string | null {
  return v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : null;
}

/** Intervals.icu sends the member back here: check state, swap the code for a token, backfill 12 weeks. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = originOf(req);
  const me = await currentMember();
  if (!me) return NextResponse.redirect(new URL("/login", origin));

  const jar = await cookies();
  const state = jar.get("hg_iv_state")?.value;
  const verifier = jar.get("hg_iv_verifier")?.value;
  const nextPath = safeNext(jar.get("hg_iv_next")?.value);
  const fromPath = safeNext(jar.get("hg_iv_from")?.value);
  jar.delete({ name: "hg_iv_state", path: "/api/intervals" });
  jar.delete({ name: "hg_iv_verifier", path: "/api/intervals" });
  jar.delete({ name: "hg_iv_next", path: "/api/intervals" });
  jar.delete({ name: "hg_iv_from", path: "/api/intervals" });

  const back = (q: string, isError = false) => {
    const dest = new URL((isError ? fromPath : nextPath) ?? `/u/${me.handle}`, origin);
    dest.searchParams.set("intervals", q);
    return NextResponse.redirect(dest);
  };

  if (url.searchParams.get("error")) return back("denied", true);
  const code = url.searchParams.get("code");
  if (!code || !state || url.searchParams.get("state") !== state) return back("expired", true);
  const provider = getProvider();
  const store = await getStore();
  try {
    await connectIntervals(store, me, await provider.exchangeCode(code, verifier), Date.now());
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("intervals connect failed:", msg);
    if (msg.includes("sudah tersambung")) return back("duplicate", true);
    if (e instanceof ProviderAuthError || e instanceof ProviderError) return back("oauth_error", true);
    return back("failed", true);
  }
  const sync = await syncMember(store, provider, me.id, Date.now());
  return back(sync.ok ? "connected" : "sync_failed", false);
}
