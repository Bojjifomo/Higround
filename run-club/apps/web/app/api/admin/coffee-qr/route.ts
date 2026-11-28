import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { coffeeDailyToken, coffeeStaticToken, wibDateString } from "@/lib/coffee";
import { currentMember, qrSecret, siteUrl } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/coffee-qr
 * Generates both:
 *  - Daily Rotating Counter QR (changes each WIB day — great for cashier tablet)
 *  - Permanent Printable Table/Counter Sticker QR (strictly enforced 1x/day per member on server)
 */
export async function GET(req: Request) {
  const me = await currentMember();
  if (!me || (me.role !== "admin" && me.role !== "instructor")) {
    return NextResponse.json({ ok: false, error: "Khusus admin / barista Higround." }, { status: 403 });
  }

  const parsedUrl = new URL(req.url);
  const origin = siteUrl(
    req.headers.get("host") ?? parsedUrl.host,
    req.headers.get("x-forwarded-proto") ?? parsedUrl.protocol.replace(":", ""),
  );
  const dateWib = wibDateString(Date.now());
  const secret = qrSecret();
  const dailyUrl = `${origin}/coffee-checkin?t=${encodeURIComponent(coffeeDailyToken(secret, dateWib))}`;
  const staticUrl = `${origin}/coffee-checkin?t=${encodeURIComponent(coffeeStaticToken(secret))}`;

  const qrOpts = {
    type: "svg" as const,
    margin: 1,
    errorCorrectionLevel: "M" as const,
    color: { dark: "#241917", light: "#FFFFFF" },
  };
  const [dailySvg, staticSvg] = await Promise.all([
    QRCode.toString(dailyUrl, qrOpts),
    QRCode.toString(staticUrl, qrOpts),
  ]);

  return NextResponse.json({
    ok: true,
    dateWib,
    dailyUrl,
    dailySvg,
    staticUrl,
    staticSvg,
  });
}
