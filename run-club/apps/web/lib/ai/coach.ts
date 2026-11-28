/**
 * AI Running Coach powered by Google Gemini API (Roadmap v4 — Fase E).
 * Reads a member's privacy-safe running history (NO GPS coordinates ever leave the server!)
 * and provides actionable coaching in casual Indonesian.
 *
 * When GEMINI_API_KEY is not configured yet, returns a smart rule-based local preview
 * so the dashboard UI works cleanly without errors until the owner adds a key.
 */
import type { RunView } from "../data/service";
import { duration, km, pace } from "../format";
import { PB_BADGE_SPECS } from "../runs";

export interface CoachSummary {
  displayName: string;
  level: number;
  weekKm: number;
  monthKm: number;
  totalKm: number;
  runs: number;
  walkKmTotal: number;
  higroundStarts: number;
  avgLast4WeeksKm: number;
  activeDaysLast31: number;
  latestPace: string;
  pbs: { label: string; time: string }[];
  recentRuns: { name: string; date: string; km: string; pace: string; isWalk: boolean }[];
}

export interface CoachReply {
  ok: true;
  configured: boolean;
  model: string;
  reply: string;
  summary: CoachSummary;
}

export function buildCoachSummary(displayName: string, level: number, run: RunView): CoachSummary {
  const last4 = run.weeks.slice(-4);
  const avgLast4WeeksKm = last4.reduce((s, w) => s + w.km, 0) / Math.max(1, last4.length);
  const activeDaysLast31 = run.days31.filter((d) => d.totalKm > 0).length;
  const lastPaceWeek = [...run.weeks].reverse().find((w) => w.paceSPerKm !== null);
  const latestPace = lastPaceWeek?.paceSPerKm ? `${pace(lastPaceWeek.paceSPerKm)}/km` : "belum ada";

  const pbs = PB_BADGE_SPECS.flatMap((spec) => {
    const res = run.pbBadges[spec.key];
    return res ? [{ label: spec.shortLabel, time: duration(res.timeS) }] : [];
  });

  const recentRuns = run.recent
    .filter((a) => a.status === "ok" || a.status === "approved" || a.isWalk)
    .slice(0, 8)
    .map((a) => {
      const distKm = a.distanceM / 1000;
      return {
        name: a.name ?? a.type,
        date: a.startTime.slice(0, 10),
        km: `${km(distKm)} km`,
        pace: distKm > 0 ? `${pace(a.movingTimeS / distKm)}/km` : "-",
        isWalk: a.isWalk,
      };
    });

  return {
    displayName,
    level,
    weekKm: run.weekKm,
    monthKm: run.monthKm,
    totalKm: run.totalKm,
    runs: run.runs,
    walkKmTotal: run.walk.totalKm,
    higroundStarts: run.higroundStarts,
    avgLast4WeeksKm,
    activeDaysLast31,
    latestPace,
    pbs,
    recentRuns,
  };
}

/** Deterministic local coaching preview used when GEMINI_API_KEY is not yet configured. */
export function buildLocalPreviewReply(summary: CoachSummary, question?: string): string {
  const first = summary.displayName.split(" ")[0];
  const lines: string[] = [];

  if (summary.runs === 0) {
    lines.push(`Halo ${first}! Belum ada catatan lari tersinkronisasi nih — yuk sambungkan jam ke Intervals.icu dulu biar Coach bisa baca data larimu.`);
    lines.push("");
    lines.push("Rekomendasi start awal minggu ini:");
    lines.push("• 2–3× Easy Run santai 3–5 km (pace ngobrol, nggak usah ngebut).");
    lines.push("• 1× Jalan kaki santai 30 menit buat recovery aktif.");
    lines.push("• Join Sunday Long Run dari Higround biar makin seru bareng komunitas! ☕");
    return lines.join("\n");
  }

  const targetNextWeek = Math.max(8, Math.round(summary.avgLast4WeeksKm * 1.1));
  lines.push(`Halo ${first}! Ini ringkasan cepat dari data larimu:`);
  lines.push("");
  lines.push(`📊 **Kondisi Saat Ini:**`);
  lines.push(`• Minggu ini: ${km(summary.weekKm)} km · Rata-rata 4 minggu terakhir: ${km(summary.avgLast4WeeksKm)} km/minggu`);
  lines.push(`• Konsistensi 31 hari: ${summary.activeDaysLast31} hari aktif · Pace terbaru: ${summary.latestPace}`);
  if (summary.pbs.length > 0) {
    lines.push(`• Rekor PB tercatat: ${summary.pbs.map((p) => `${p.label} (${p.time})`).join(", ")}`);
  }

  lines.push("");
  lines.push(`🎯 **Saran Latihan Minggu Depan (~${targetNextWeek} km):**`);
  if (summary.avgLast4WeeksKm < 15) {
    lines.push("• Fokus bangun fondasi aerobik: 3× Easy Run @ 4–5 km dengan pace santai (bisa sambil ngobrol).");
    lines.push("• Tambah 1 sesi Jalan Kaki / recovery walk supaya sendi tetap segar.");
  } else if (summary.avgLast4WeeksKm < 35) {
    lines.push("• 2× Easy Run (5–7 km) + 1× Tempo/Fartlek ringan (20 menit) + 1× Sunday Long Run santai (10–14 km).");
    lines.push("• Jaga kenaikan volume maksimal +10% per minggu biar bebas cedera.");
  } else {
    lines.push("• Volume mingguanmu udah solid! Pertahankan komposisi 80% Easy Run + 20% Quality (Interval/Tempo).");
    lines.push("• Jangan lupa 1 minggu deload (-25% volume) tiap 3–4 minggu supaya puncak performa makin tajam.");
  }

  if (question?.trim()) {
    lines.push("");
    lines.push(`💬 *Catatan untuk pertanyaanmu ("${question.trim().slice(0, 80)}"):* tambahkan \`GEMINI_API_KEY\` di server untuk jawaban personal mendalam dari Gemini AI Coach.`);
  }

  return lines.join("\n");
}

/**
 * Ask the AI Running Coach. Uses Gemini REST API when `apiKey` is provided,
 * otherwise falls back gracefully to the rule-based local preview.
 */
export async function askRunningCoach(
  summary: CoachSummary,
  question: string,
  opts: {
    apiKey?: string;
    model?: string;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<CoachReply> {
  const apiKey = (opts.apiKey ?? process.env.GEMINI_API_KEY ?? "").trim();
  const model = (opts.model ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash").trim();

  if (!apiKey) {
    return {
      ok: true,
      configured: false,
      model: "local-preview",
      reply: buildLocalPreviewReply(summary, question),
      summary,
    };
  }

  const systemPrompt = [
    "Kamu adalah AI Running Coach resmi Higround Run Club (Harapan Indah, Bekasi).",
    "Gaya bahasa: santai, hangat, suportif, pakai Bahasa Indonesia natural (kamu/aku atau gue/lu sopan), singkat & actionable.",
    "Aturan wajib:",
    "- Analisa HANYA berdasarkan data statistik lari member di bawah ini (jangan mengarang angka).",
    "- Fokus pada volume mingguan, konsistensi 31 hari, pace, pencegahan cedera (aturan kenaikan 10%), recovery, dan target PB realistis.",
    "- Maksimal 220 kata dengan bullet points rapi.",
  ].join("\n");

  const userPrompt = [
    `Data Pelari (${summary.displayName}, Lv ${summary.level}):`,
    `- Minggu ini: ${km(summary.weekKm)} km | Bulan ini: ${km(summary.monthKm)} km | Total: ${km(summary.totalKm)} km (${summary.runs} sesi lari)`,
    `- Rata-rata 4 minggu terakhir: ${km(summary.avgLast4WeeksKm)} km/minggu | Hari aktif 31 hari terakhir: ${summary.activeDaysLast31} hari`,
    `- Pace terbaru: ${summary.latestPace} | Total jalan kaki: ${km(summary.walkKmTotal)} km | Start dari Higround: ${summary.higroundStarts}×`,
    `- PB: ${summary.pbs.length ? summary.pbs.map((p) => `${p.label} ${p.time}`).join(", ") : "belum ada"}`,
    `- 8 Aktivitas terakhir: ${summary.recentRuns.map((r) => `${r.date} ${r.isWalk ? "[Walk]" : "[Run]"} ${r.name} ${r.km} (${r.pace})`).join(" ; ") || "belum ada"}`,
    "",
    `Pertanyaan member: ${question.trim() || "Evaluasi progres lariku 4 minggu terakhir dan kasih rencana latihan minggu depan."}`,
  ].join("\n");

  const fetchFn = opts.fetchImpl ?? fetch;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetchFn(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 600 },
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemini HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
    if (!text) throw new Error("Gemini empty response");

    return { ok: true, configured: true, model, reply: text, summary };
  } catch {
    return {
      ok: true,
      configured: false,
      model: "local-fallback",
      reply: `${buildLocalPreviewReply(summary, question)}\n\n*(Catatan: koneksi ke Gemini API sedang sibuk — menampilkan analisis cepat lokal.)*`,
      summary,
    };
  }
}
