"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Panel } from "@/components/ui";
import { LUNAPOS_SAMPLE_CSV, type GiveawayRecord, type MemberCrmRow } from "@/lib/admin/crm";
import { dateShort, km } from "@/lib/format";

export function AdminCrmClient({
  rows,
  giveaways,
  lastLunaSyncAt,
  resendConfigured,
}: {
  rows: MemberCrmRow[];
  giveaways: GiveawayRecord[];
  lastLunaSyncAt: string | null;
  resendConfigured: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  // Giveaway state
  const [winnerId, setWinnerId] = useState<string>(rows[0]?.id ?? "");
  const [emailOverride, setEmailOverride] = useState("");
  const [prizeName, setPrizeName] = useState("Free Drink Pilihan Higround");
  const [giveawayNote, setGiveawayNote] = useState("");
  const [giveawayBusy, setGiveawayBusy] = useState(false);
  const [giveawayMsg, setGiveawayMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // LunaPOS CSV upload state
  const [lunaBusy, setLunaBusy] = useState(false);
  const [lunaMsg, setLunaMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const filtered = search.trim()
    ? rows.filter((r) =>
        `${r.displayName} ${r.handle} ${r.email ?? ""} ${r.luna?.lunaTier ?? ""}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      )
    : rows;

  const selectedWinner = rows.find((r) => r.id === winnerId) ?? null;

  const drawRandomContributor = () => {
    const active = rows.filter((r) => r.weekKm > 0);
    const pool = active.length > 0 ? active : rows;
    if (pool.length === 0) return;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    setWinnerId(picked.id);
    setEmailOverride(picked.email ?? "");
    setGiveawayMsg({
      ok: true,
      text: `🎲 Terpilih acak dari ${active.length > 0 ? "kontributor lari minggu ini" : "semua member"}: ${picked.displayName} (${km(picked.weekKm)} km minggu ini)!`,
    });
  };

  const sendGiveaway = async () => {
    if (!winnerId) return;
    setGiveawayBusy(true);
    setGiveawayMsg(null);
    try {
      const res = await fetch("/api/admin/giveaway/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: winnerId,
          emailOverride: emailOverride.trim() || undefined,
          prizeName,
          note: giveawayNote,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        voucherCode?: string;
        winnerName?: string;
        email?: string;
        error?: string;
        configured?: boolean;
      };
      if (data.ok) {
        setGiveawayMsg({
          ok: true,
          text: `✅ Email pemenang terkirim via Resend ke ${data.email}! Kode voucher: ${data.voucherCode}`,
        });
        router.refresh();
      } else if (data.configured === false && data.voucherCode) {
        setGiveawayMsg({
          ok: false,
          text: `⚠️ Pemenang & kode voucher (${data.voucherCode}) tercatat, tapi email belum terkirim: ${data.error}`,
        });
        router.refresh();
      } else {
        setGiveawayMsg({ ok: false, text: `❌ ${data.error ?? "Gagal mengirim email giveaway."}` });
      }
    } catch {
      setGiveawayMsg({ ok: false, text: "❌ Koneksi terputus saat kirim giveaway." });
    } finally {
      setGiveawayBusy(false);
    }
  };

  const uploadLunaCsv = async (file: File) => {
    setLunaBusy(true);
    setLunaMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/lunapos/sync", { method: "POST", body: form });
      const data = (await res.json()) as {
        ok?: boolean;
        totalRows?: number;
        matchedCount?: number;
        unmatchedCount?: number;
        unmatchedLabels?: string[];
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setLunaMsg({ ok: false, text: `❌ ${data.error ?? "Gagal sync CSV LunaPOS."}` });
      } else {
        const extra = data.unmatchedCount
          ? ` (${data.unmatchedCount} baris tidak cocok: ${(data.unmatchedLabels ?? []).slice(0, 5).join(", ")})`
          : "";
        setLunaMsg({
          ok: true,
          text: `✅ Sync LunaPOS selesai! ${data.matchedCount} dari ${data.totalRows} baris cocok ke member Higround.${extra}`,
        });
        router.refresh();
      }
    } catch {
      setLunaMsg({ ok: false, text: "❌ Gagal mengupload file CSV." });
    } finally {
      setLunaBusy(false);
    }
  };

  const downloadSampleLuna = () => {
    const blob = new Blob([LUNAPOS_SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contoh-lunapos-loyalty.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <div className="space-y-5">
      {/* 1. Database Member Terkumpul + Export CSV */}
      <Panel
        title={`📋 Database Member (${rows.length})`}
        aside={
          <a
            href="/api/admin/members/export"
            className="rounded-md border-2 border-black bg-hg-yellow px-3 py-1 text-xs font-bold text-black shadow-[2px_2px_0_#111] hover:brightness-95"
          >
            📥 Export CSV (Excel)
          </a>
        }
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, @handle, email, atau tier LunaPOS..."
            className="w-full max-w-sm rounded-md border-2 border-[#2b1d17] bg-white px-3 py-1.5 text-sm"
          />
          <span className="text-xs text-neutral-600">
            Menampilkan <b>{filtered.length}</b> member · Siap untuk giveaway &amp; CRM
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b-2 border-[#2b1d17] text-neutral-600">
                <th className="py-1.5 pr-3">Member</th>
                <th className="py-1.5 pr-3">Email</th>
                <th className="py-1.5 pr-3 text-right">Minggu Ini</th>
                <th className="py-1.5 pr-3 text-right">Total KM</th>
                <th className="py-1.5 pr-3 text-right">Lv</th>
                <th className="py-1.5 pr-3">LunaPOS Loyalty</th>
                <th className="py-1.5 text-right">Gabung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE6D3]">
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="py-1.5 pr-3">
                    <Link href={`/u/${r.handle}`} className="font-bold hover:underline">
                      {r.displayName}
                    </Link>{" "}
                    <span className="text-neutral-500">@{r.handle}</span>
                  </td>
                  <td className="py-1.5 pr-3 font-mono text-[11px] text-neutral-700">{r.email ?? "–"}</td>
                  <td className="py-1.5 pr-3 text-right font-bold tabular-nums text-hg-orange">{km(r.weekKm)} km</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{km(r.totalKm)} km</td>
                  <td className="py-1.5 pr-3 text-right font-bold tabular-nums">{r.level}</td>
                  <td className="py-1.5 pr-3">
                    {r.luna ? (
                      <span className="inline-block rounded border border-emerald-700 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-900">
                        {r.luna.lunaTier ?? "Member"} · {r.luna.lunaPoints} pts
                      </span>
                    ) : (
                      <span className="text-neutral-400">belum sync</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right text-neutral-500">{dateShort(r.joinedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* 2. Giveaway Free Drinks + Kirim Email via Resend */}
      <Panel
        title="🎁 Giveaway Free Drinks (Resend Email)"
        aside={
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${
              resendConfigured
                ? "border-emerald-700 bg-emerald-50 text-emerald-800"
                : "border-hg-orange bg-[#FFF1E6] text-hg-orange"
            }`}
          >
            {resendConfigured ? "✅ Resend Aktif" : "⚙️ Set RESEND_API_KEY"}
          </span>
        }
      >
        <p className="mb-3 text-xs text-neutral-600">
          Undi pemenang dari kontributor lari aktif minggu ini atau pilih manual, lalu kirim kode voucher <b>Free Drinks</b> langsung ke email pemenang lewat Resend.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold" htmlFor="gw-member">Pilih Pemenang</label>
            <div className="flex gap-2">
              <select
                id="gw-member"
                value={winnerId}
                onChange={(e) => {
                  const id = e.target.value;
                  setWinnerId(id);
                  const found = rows.find((r) => r.id === id);
                  setEmailOverride(found?.email ?? "");
                }}
                className="min-w-0 flex-1 rounded-md border-2 border-[#2b1d17] bg-white px-2.5 py-1.5 text-sm font-bold"
              >
                {rows.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.displayName} ({km(r.weekKm)} km minggu ini)
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={drawRandomContributor}
                className="shrink-0 rounded-md border-2 border-black bg-hg-yellow px-3 py-1.5 text-xs font-bold text-black shadow-[2px_2px_0_#111]"
              >
                🎲 Undi
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold" htmlFor="gw-email">Email Tujuan</label>
            <input
              id="gw-email"
              type="email"
              value={emailOverride || selectedWinner?.email || ""}
              onChange={(e) => setEmailOverride(e.target.value)}
              placeholder="nama@email.com"
              className="w-full rounded-md border-2 border-[#2b1d17] bg-white px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold" htmlFor="gw-prize">Hadiah Giveaway</label>
            <input
              id="gw-prize"
              value={prizeName}
              onChange={(e) => setPrizeName(e.target.value)}
              className="w-full rounded-md border-2 border-[#2b1d17] bg-white px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold" htmlFor="gw-note">Catatan Tambahan (Opsional)</label>
            <input
              id="gw-note"
              value={giveawayNote}
              onChange={(e) => setGiveawayNote(e.target.value)}
              placeholder="Mis. Berlaku sampai akhir bulan ya!"
              className="w-full rounded-md border-2 border-[#2b1d17] bg-white px-3 py-1.5 text-sm"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={giveawayBusy || !winnerId}
            onClick={sendGiveaway}
            className="rounded-md border-2 border-black bg-hg-orange px-4 py-1.5 text-sm font-bold text-white shadow-[2px_2px_0_#111] hover:brightness-105 disabled:opacity-50"
          >
            {giveawayBusy ? "Mengirim..." : "📧 Kirim Email Pemenang (Resend)"}
          </button>
          {giveawayMsg && (
            <span className={`text-xs font-bold ${giveawayMsg.ok ? "text-emerald-800" : "text-hg-red"}`}>
              {giveawayMsg.text}
            </span>
          )}
        </div>

        {giveaways.length > 0 && (
          <div className="mt-4 border-t border-[#EFE6D3] pt-3">
            <h3 className="mb-1.5 text-xs font-bold text-neutral-600">Riwayat Pemenang Giveaway</h3>
            <ul className="divide-y divide-[#EFE6D3] text-xs">
              {giveaways.slice(0, 8).map((g) => (
                <li key={g.id} className="flex flex-wrap items-center gap-2 py-1.5">
                  <span className="font-bold">{g.displayName}</span>
                  <span className="text-neutral-500">({g.email})</span>
                  <span>· {g.prizeName}</span>
                  <span className="rounded bg-hg-yellow px-1.5 py-0.5 font-mono text-[11px] font-bold">{g.voucherCode}</span>
                  <span className="ml-auto text-neutral-500">
                    {g.sentViaResend ? "✅ email terkirim" : "📝 tercatat lokal"} · {dateShort(g.sentAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      {/* 3. LunaPOS Monthly CSV Loyalty Sync */}
      <Panel
        title="🧾 Loyalty Member Higround — LunaPOS Monthly CSV Sync"
        aside={
          lastLunaSyncAt ? (
            <span className="text-xs text-neutral-500">Sync terakhir: {dateShort(lastLunaSyncAt)}</span>
          ) : null
        }
      >
        <p className="mb-3 text-xs text-neutral-600">
          Export data member/loyalty bulanan dari backoffice <b>LunaPOS</b> dalam format <code>.csv</code>, lalu upload di sini. Sistem otomatis mencocokkan lewat <b>Email</b> atau <b>Nama Member</b> untuk memperbarui Tier &amp; Poin Loyalty di Database Member.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-md border-2 border-black bg-hg-navy px-4 py-1.5 text-sm font-bold text-white shadow-[2px_2px_0_#111] hover:brightness-110">
            {lunaBusy ? "Memproses CSV..." : "📤 Upload CSV LunaPOS"}
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={lunaBusy}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadLunaCsv(file);
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            onClick={downloadSampleLuna}
            className="rounded-md border-2 border-[#2b1d17] bg-white px-3 py-1.5 text-xs font-bold hover:bg-[#EFE6D3]"
          >
            📄 Download Contoh Template CSV
          </button>
        </div>

        {lunaMsg && (
          <p className={`mt-2.5 text-xs font-bold ${lunaMsg.ok ? "text-emerald-800" : "text-hg-red"}`}>
            {lunaMsg.text}
          </p>
        )}
      </Panel>
    </div>
  );
}
