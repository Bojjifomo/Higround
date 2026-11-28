"use client";
import { useState } from "react";
import { Panel } from "@/components/ui";

const QUICK_PROMPTS = [
  "Evaluasi 4 minggu terakhir & kasih saran latihan minggu depan",
  "Gimana strategi biar bisa pecah PB 5K / 10K dengan aman?",
  "Cek konsistensi & porsi recovery lariku bulan ini",
];

export function RunningCoachCard({ geminiConfigured }: { geminiConfigured: boolean }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [modelLabel, setModelLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ask = async (promptText: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: promptText }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        reply?: string;
        configured?: boolean;
        model?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.reply) {
        setError(data.error ?? "Gagal meminta saran Coach.");
      } else {
        setReply(data.reply);
        setModelLabel(data.configured ? `Gemini AI (${data.model})` : "Preview Coach Lokal");
      }
    } catch {
      setError("Koneksi terputus. Coba lagi sebentar lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Panel
      title="🤖 AI Running Coach"
      aside={
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${
            geminiConfigured
              ? "border-emerald-700 bg-emerald-50 text-emerald-800"
              : "border-hg-orange bg-[#FFF1E6] text-hg-orange"
          }`}
        >
          {geminiConfigured ? "✨ Gemini Aktif" : "⚡ Preview Mode"}
        </span>
      }
    >
      <p className="text-xs text-neutral-600">
        Coach membaca riwayat lari, tren pace, volume 4 minggu, dan PB-mu (tanpa GPS) buat kasih masukan latihan personal.
        {!geminiConfigured && (
          <>
            {" "}
            <span className="font-semibold text-neutral-700">
              (Tambahkan <code>GEMINI_API_KEY</code> di server untuk jawaban penuh Gemini AI — sementara analisis cepat lokal sudah bisa dicoba!)
            </span>
          </>
        )}
      </p>

      {/* Quick one-tap prompt chips */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            disabled={loading}
            onClick={() => {
              setQuestion(p);
              void ask(p);
            }}
            className="rounded-lg border-2 border-[#2b1d17] bg-white px-2.5 py-1.5 text-left text-xs font-bold text-[#241917] shadow-[2px_2px_0_#111] hover:bg-hg-yellow disabled:opacity-50"
          >
            ✨ {p}
          </button>
        ))}
      </div>

      {/* Custom question form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={240}
          placeholder="Tanya Coach soal pace, target HM, atau recovery..."
          className="min-w-0 flex-1 rounded-md border-2 border-[#2b1d17] bg-white px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md border-2 border-black bg-hg-orange px-3.5 py-1.5 text-sm font-bold text-white shadow-[2px_2px_0_#111] hover:brightness-105 disabled:opacity-50"
        >
          {loading ? "Menganalisa..." : "Tanya Coach"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-2 text-xs font-bold text-hg-red">
          ⚠️ {error}
        </p>
      )}

      {reply && (
        <div className="mt-3 rounded-xl border-2 border-[#2b1d17] bg-white p-3.5 text-sm leading-relaxed text-[#241917]">
          {modelLabel && (
            <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-hg-orange">
              {modelLabel}
            </div>
          )}
          <div className="whitespace-pre-line">{reply}</div>
        </div>
      )}
    </Panel>
  );
}
