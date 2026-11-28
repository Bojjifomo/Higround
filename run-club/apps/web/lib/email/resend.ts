/**
 * Resend REST API email sender for Higround Run Club Giveaway Winners (Roadmap v4 — Fase E).
 * Uses standard fetch (no extra SDK dependency). Gracefully reports unconfigured state if
 * RESEND_API_KEY is not yet set in .env.local.
 */

export interface GiveawayEmailInput {
  toEmail: string;
  recipientName: string;
  prizeName: string;
  voucherCode: string;
  note?: string;
}

export type GiveawayEmailResult =
  | { ok: true; id: string; voucherCode: string }
  | { ok: false; configured: boolean; voucherCode: string; error: string };

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function generateGiveawayCode(handle: string, now = Date.now()): string {
  const tag = handle.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 5) || "RUNNER";
  const suffix = (now % 10000).toString().padStart(4, "0");
  return `HG-GIV-${tag}-${suffix}`;
}

export async function sendGiveawayWinnerEmail(
  input: GiveawayEmailInput,
  opts: {
    apiKey?: string;
    from?: string;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<GiveawayEmailResult> {
  const apiKey = (opts.apiKey ?? process.env.RESEND_API_KEY ?? "").trim();
  const from = (opts.from ?? process.env.RESEND_FROM ?? "Higround Run Club <onboarding@resend.dev>").trim();

  if (!apiKey) {
    return {
      ok: false,
      configured: false,
      voucherCode: input.voucherCode,
      error: "RESEND_API_KEY belum diset di .env.local. Tambahkan RESEND_API_KEY untuk mengirim email otomatis.",
    };
  }

  const subject = `🎉 Selamat ${input.recipientName}! Kamu Menang Giveaway ${input.prizeName} — Higround Run Club`;
  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#FFF8EA;border:3px solid #241917;border-radius:16px;color:#241917">
      <div style="display:inline-block;background:#FF5F0E;color:#fff;padding:4px 12px;border-radius:999px;font-weight:800;font-size:12px">
        HIGROUND RUN CLUB · GIVEAWAY WINNER
      </div>
      <h1 style="margin:14px 0 8px;font-size:24px">Selamat, ${escapeHtml(input.recipientName)}! ☕🏃</h1>
      <p style="margin:0 0 14px;line-height:1.5">
        Terima kasih udah aktif lari dan ikut meramaikan komunitas Higround Run Club! Kamu terpilih sebagai pemenang giveaway:
      </p>
      <div style="background:#FFFFFF;border:2px solid #241917;border-radius:12px;padding:16px;text-align:center;margin:16px 0">
        <div style="font-size:12px;font-weight:800;color:#6B5B4B;text-transform:uppercase">Hadiah Kamu</div>
        <div style="font-size:20px;font-weight:900;color:#FF5F0E;margin-top:4px">${escapeHtml(input.prizeName)}</div>
        <div style="margin-top:12px;display:inline-block;background:#F7D046;border:2px solid #241917;border-radius:8px;padding:8px 16px;font-family:monospace;font-size:18px;font-weight:900">
          ${escapeHtml(input.voucherCode)}
        </div>
      </div>
      ${input.note ? `<p style="margin:0 0 14px;font-size:14px"><b>Catatan dari tim Higround:</b> ${escapeHtml(input.note)}</p>` : ""}
      <p style="margin:0 0 10px;font-size:13px;line-height:1.5">
        <b>Cara klaim:</b> Tunjukkan email dan kode voucher ini ke kasir di <b>Higround Coffee &amp; Burger (Harapan Indah)</b> saat mampir ngopi/habis lari!
      </p>
      <p style="margin:16px 0 0;font-size:12px;color:#6B5B4B">
        Sampai ketemu di Start Gate! — Tim Higround Run Club (@higround.coffee)
      </p>
    </div>
  `.trim();

  const text = [
    `Selamat ${input.recipientName}!`,
    `Kamu terpilih sebagai pemenang giveaway Higround Run Club: ${input.prizeName}.`,
    `Kode Voucher Kasir: ${input.voucherCode}`,
    input.note ? `Catatan: ${input.note}` : "",
    "Tunjukkan email ini ke kasir Higround Coffee & Burger (Harapan Indah) untuk klaim hadiahmu!",
  ].filter(Boolean).join("\n\n");

  const fetchFn = opts.fetchImpl ?? fetch;
  try {
    const res = await fetchFn("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.toEmail],
        subject,
        html,
        text,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string; error?: { message?: string } };
    if (!res.ok || !data.id) {
      return {
        ok: false,
        configured: true,
        voucherCode: input.voucherCode,
        error: data.message ?? data.error?.message ?? `Resend HTTP ${res.status}`,
      };
    }
    return { ok: true, id: data.id, voucherCode: input.voucherCode };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      voucherCode: input.voucherCode,
      error: err instanceof Error ? err.message : "Gagal menghubungi Resend API",
    };
  }
}
