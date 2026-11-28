"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Panel, Stat } from "@/components/ui";
import {
  LUNAPOS_SAMPLE_CSV,
  type GiveawayRecord,
  type MemberCrmRow,
  type WorldAnnouncement,
} from "@/lib/admin/crm";
import type { WorldChatMessage } from "@/lib/chat/store";
import { dateShort, int, km } from "@/lib/format";

export interface AdminSystemStats {
  totalMembers: number;
  connectedIntervals: number;
  activeWeekMembers: number;
  weekKmTotal: number;
  higroundStartsTotal: number;
  onlineWorldNow: number;
  pendingFlags: number;
  intervalsLive: boolean;
  geminiConfigured: boolean;
  resendConfigured: boolean;
}

export function AdminCrmClient({
  currentAdminId,
  stats,
  rows,
  giveaways,
  lastLunaSyncAt,
  initialAnnouncement,
  initialChatMessages,
}: {
  currentAdminId: string;
  stats: AdminSystemStats;
  rows: MemberCrmRow[];
  giveaways: GiveawayRecord[];
  lastLunaSyncAt: string | null;
  initialAnnouncement: WorldAnnouncement | null;
  initialChatMessages: WorldChatMessage[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  // Force Sync All Intervals state
  const [syncAllBusy, setSyncAllBusy] = useState(false);
  const [syncAllMsg, setSyncAllMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Broadcast & Chat Moderation state
  const [announcement, setAnnouncement] = useState<WorldAnnouncement | null>(initialAnnouncement);
  const [broadcastText, setBroadcastText] = useState("");
  const [pinBanner, setPinBanner] = useState(true);
  const [broadcastBusy, setBroadcastBusy] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState<string | null>(null);
  const [chatList, setChatList] = useState<WorldChatMessage[]>(initialChatMessages);
  const [modBusy, setModBusy] = useState(false);

  // Role switcher feedback
  const [roleBusyId, setRoleBusyId] = useState<string | null>(null);
  const [roleMsg, setRoleMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Giveaway state
  const [winnerId, setWinnerId] = useState<string>(rows[0]?.id ?? "");
  const [emailOverride, setEmailOverride] = useState("");
  const [prizeName, setPrizeName] = useState("Free Drink Pilihan Higround");
  const [giveawayNote, setGiveawayNote] = useState("");
  const [giveawayBusy, setGiveawayBusy] = useState(false);
  const [giveawayMsg, setGiveawayMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [redeemBusyId, setRedeemBusyId] = useState<string | null>(null);

  // LunaPOS CSV upload state
  const [lunaBusy, setLunaBusy] = useState(false);
  const [lunaMsg, setLunaMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const filtered = search.trim()
    ? rows.filter((r) =>
        `${r.displayName} ${r.handle} ${r.email ?? ""} ${r.luna?.lunaTier ?? ""} ${r.role}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      )
    : rows;

  const selectedWinner = rows.find((r) => r.id === winnerId) ?? null;

  const runSyncAll = async () => {
    setSyncAllBusy(true);
    setSyncAllMsg(null);
    try {
      const res = await fetch("/api/admin/sync-all", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; synced?: number; failed?: number; error?: string };
      if (!res.ok || !data.ok) {
        setSyncAllMsg({ ok: false, text: `❌ ${data.error ?? "Gagal sync semua member."}` });
      } else {
        setSyncAllMsg({
          ok: true,
          text: `✅ Sync selesai: ${data.synced ?? 0} akun berhasil${data.failed ? `, ${data.failed} gagal` : ""}.`,
        });
        router.refresh();
      }
    } catch {
      setSyncAllMsg({ ok: false, text: "❌ Koneksi terputus." });
    } finally {
      setSyncAllBusy(false);
    }
  };

  const sendBroadcast = async () => {
    if (!broadcastText.trim()) return;
    setBroadcastBusy(true);
    setBroadcastMsg(null);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: broadcastText, pinBanner }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: WorldChatMessage;
        announcement?: WorldAnnouncement | null;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setBroadcastMsg(`❌ ${data.error ?? "Gagal kirim pengumuman."}`);
      } else {
        setBroadcastText("");
        if (data.announcement !== undefined) setAnnouncement(data.announcement);
        if (data.message) setChatList((prev) => [...prev, data.message!].slice(-40));
        setBroadcastMsg("✅ Pengumuman terkirim ke World Chat" + (pinBanner ? " & di-pin di atas /world!" : "!"));
      }
    } catch {
      setBroadcastMsg("❌ Koneksi terputus.");
    } finally {
      setBroadcastBusy(false);
    }
  };

  const clearBanner = async () => {
    setBroadcastBusy(true);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearBanner: true }),
      });
      if (res.ok) {
        setAnnouncement(null);
        setBroadcastMsg("Banner pengumuman di /world sudah dilepas.");
      }
    } finally {
      setBroadcastBusy(false);
    }
  };

  const moderateChat = async (payload: { action: "delete"; id: string } | { action: "clear" }) => {
    setModBusy(true);
    try {
      const res = await fetch("/api/admin/chat/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok?: boolean; messages?: WorldChatMessage[] };
      if (res.ok && data.ok && Array.isArray(data.messages)) {
        setChatList(data.messages);
      }
    } finally {
      setModBusy(false);
    }
  };

  const updateMemberRole = async (userId: string, role: string) => {
    setRoleBusyId(userId);
    setRoleMsg(null);
    try {
      const res = await fetch("/api/admin/members/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setRoleMsg({ ok: false, text: `❌ ${data.error ?? "Gagal update role."}` });
      } else {
        setRoleMsg({ ok: true, text: `✅ Role berhasil diubah menjadi ${role}.` });
        router.refresh();
      }
    } catch {
      setRoleMsg({ ok: false, text: "❌ Koneksi terputus." });
    } finally {
      setRoleBusyId(null);
    }
  };

  const toggleRedeemGiveaway = async (id: string) => {
    setRedeemBusyId(id);
    try {
      const res = await fetch("/api/admin/giveaway/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) router.refresh();
    } finally {
      setRedeemBusyId(null);
    }
  };

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
      {/* 0. Club Pulse KPI & Quick Admin Operations */}
      <Panel
        title="📊 Ringkasan Klub & Kontrol Cepat"
        aside={
          <button
            type="button"
            disabled={syncAllBusy}
            onClick={runSyncAll}
            className="rounded-md border-2 border-black bg-hg-orange px-3 py-1 text-xs font-bold text-white shadow-[2px_2px_0_#111] hover:brightness-105 disabled:opacity-50"
          >
            {syncAllBusy ? "Menyinkronkan semua..." : "🔄 Sync Semua Intervals.icu"}
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-lg border border-[#E7DCC4] bg-white p-2.5">
            <Stat value={int(stats.totalMembers)} label="Total Member" />
          </div>
          <div className="rounded-lg border border-[#E7DCC4] bg-white p-2.5">
            <Stat value={int(stats.connectedIntervals)} label="Jam Tersambung" />
          </div>
          <div className="rounded-lg border-2 border-black bg-[#FFF1E6] p-2.5">
            <Stat value={km(stats.weekKmTotal)} unit="km" label="KM Klub Minggu Ini" />
          </div>
          <div className="rounded-lg border border-[#E7DCC4] bg-white p-2.5">
            <Stat value={int(stats.activeWeekMembers)} label="Aktif Minggu Ini" />
          </div>
          <div className="rounded-lg border border-[#E7DCC4] bg-white p-2.5">
            <Stat value={int(stats.higroundStartsTotal)} label="Total Start Higround" />
          </div>
          <div className="rounded-lg border border-[#E7DCC4] bg-white p-2.5">
            <Stat value={int(stats.onlineWorldNow)} label="Online di /world" />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold">
          <span className={`rounded-full border px-2 py-0.5 ${stats.intervalsLive ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-amber-600 bg-amber-50 text-amber-800"}`}>
            ⌚ Intervals.icu: {stats.intervalsLive ? "Live OAuth" : "Mock Mode"}
          </span>
          <span className={`rounded-full border px-2 py-0.5 ${stats.geminiConfigured ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-neutral-400 bg-neutral-100 text-neutral-600"}`}>
            🤖 Gemini AI Coach: {stats.geminiConfigured ? "Aktif" : "Preview Lokal"}
          </span>
          <span className={`rounded-full border px-2 py-0.5 ${stats.resendConfigured ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-neutral-400 bg-neutral-100 text-neutral-600"}`}>
            📧 Resend Email: {stats.resendConfigured ? "Aktif" : "Belum Diset"}
          </span>
          {stats.pendingFlags > 0 && (
            <span className="rounded-full border border-hg-red bg-red-50 px-2 py-0.5 text-hg-red">
              ⚠️ {stats.pendingFlags} aktivitas menunggu review
            </span>
          )}
        </div>

        {syncAllMsg && (
          <p className={`mt-2.5 text-xs font-bold ${syncAllMsg.ok ? "text-emerald-800" : "text-hg-red"}`}>
            {syncAllMsg.text}
          </p>
        )}
      </Panel>

      {/* 1. Broadcast Pengumuman ke /world + Moderasi World Chat */}
      <Panel title="📣 Broadcast Pengumuman & Moderasi World Chat">
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Broadcast Megaphone */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-neutral-600">
              Kirim Pengumuman ke `/world`
            </h3>
            <textarea
              rows={2}
              value={broadcastText}
              maxLength={200}
              onChange={(e) => setBroadcastText(e.target.value)}
              placeholder="Mis. Sunday Long Run besok jam 05.15 WIB di Start Gate, ada free americano buat 10 pertama!"
              className="w-full rounded-md border-2 border-[#2b1d17] bg-white px-3 py-2 text-sm"
            />
            <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-[#241917]">
              <input
                type="checkbox"
                checked={pinBanner}
                onChange={(e) => setPinBanner(e.target.checked)}
                className="h-4 w-4 accent-[#FF5F0E]"
              />
              <span>Pin sebagai banner pengumuman live di atas `/world`</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={broadcastBusy || !broadcastText.trim()}
                onClick={sendBroadcast}
                className="rounded-md border-2 border-black bg-hg-orange px-3.5 py-1.5 text-xs font-bold text-white shadow-[2px_2px_0_#111] disabled:opacity-50"
              >
                📣 Broadcast Sekarang
              </button>
              {announcement && (
                <button
                  type="button"
                  disabled={broadcastBusy}
                  onClick={clearBanner}
                  className="rounded-md border-2 border-[#2b1d17] bg-white px-3 py-1.5 text-xs font-bold hover:bg-[#EFE6D3]"
                >
                  Lepas Banner Aktif
                </button>
              )}
            </div>
            {announcement && (
              <div className="rounded-lg border-2 border-hg-orange bg-[#FFF1E6] px-3 py-2 text-xs">
                <div className="font-extrabold text-hg-orange">📌 Banner Aktif di /world:</div>
                <div className="mt-0.5 font-medium text-[#241917]">{announcement.text}</div>
              </div>
            )}
            {broadcastMsg && <p className="text-xs font-bold text-[#241917]">{broadcastMsg}</p>}
          </div>

          {/* World Chat Moderation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wide text-neutral-600">
                🛡️ Moderasi World Chat ({chatList.length} pesan)
              </h3>
              {chatList.length > 0 && (
                <button
                  type="button"
                  disabled={modBusy}
                  onClick={() => void moderateChat({ action: "clear" })}
                  className="rounded border border-hg-red px-2 py-0.5 text-[11px] font-bold text-hg-red hover:bg-red-50"
                >
                  Bersihkan Semua
                </button>
              )}
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg border-2 border-[#2b1d17] bg-white p-2 text-xs">
              {chatList.length === 0 ? (
                <p className="py-4 text-center text-neutral-400">World Chat bersih (belum ada pesan).</p>
              ) : (
                <ul className="divide-y divide-[#EFE6D3]">
                  {[...chatList].reverse().map((m) => (
                    <li key={m.id} className="flex items-start justify-between gap-2 py-1.5">
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-[#241917]">{m.displayName}</span>:{" "}
                        <span className="break-words text-neutral-700">{m.text}</span>
                      </div>
                      <button
                        type="button"
                        disabled={modBusy}
                        onClick={() => void moderateChat({ action: "delete", id: m.id })}
                        className="shrink-0 rounded border border-neutral-300 px-1.5 py-0.5 text-[10px] font-bold text-hg-red hover:bg-red-50"
                      >
                        Hapus
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </Panel>

      {/* 2. Database Member Terkumpul + Role Management + Export CSV */}
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
            placeholder="Cari nama, @handle, email, role, atau tier LunaPOS..."
            className="w-full max-w-sm rounded-md border-2 border-[#2b1d17] bg-white px-3 py-1.5 text-sm"
          />
          <span className="text-xs text-neutral-600">
            Menampilkan <b>{filtered.length}</b> member · Atur role staff langsung di tabel
          </span>
        </div>

        {roleMsg && (
          <p className={`mb-2 text-xs font-bold ${roleMsg.ok ? "text-emerald-800" : "text-hg-red"}`}>
            {roleMsg.text}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b-2 border-[#2b1d17] text-neutral-600">
                <th className="py-1.5 pr-3">Member</th>
                <th className="py-1.5 pr-3">Email</th>
                <th className="py-1.5 pr-3">Role</th>
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
                  <td className="py-1.5 pr-3">
                    <select
                      aria-label={`Role untuk ${r.displayName}`}
                      value={r.role}
                      disabled={roleBusyId === r.id || r.id === currentAdminId}
                      onChange={(e) => void updateMemberRole(r.id, e.target.value)}
                      className="rounded border border-[#2b1d17] bg-white px-1.5 py-0.5 text-[11px] font-bold disabled:opacity-60"
                    >
                      <option value="member">member</option>
                      <option value="instructor">instructor</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
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

      {/* 3. Giveaway Free Drinks + Kirim Email via Resend + Kasir Redemption Tracker */}
      <Panel
        title="🎁 Giveaway Free Drinks (Resend Email & Kasir Tracker)"
        aside={
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${
              stats.resendConfigured
                ? "border-emerald-700 bg-emerald-50 text-emerald-800"
                : "border-hg-orange bg-[#FFF1E6] text-hg-orange"
            }`}
          >
            {stats.resendConfigured ? "✅ Resend Aktif" : "⚙️ Set RESEND_API_KEY"}
          </span>
        }
      >
        <p className="mb-3 text-xs text-neutral-600">
          Undi pemenang dari kontributor lari aktif minggu ini atau pilih manual, kirim voucher <b>Free Drinks</b> ke email pemenang via Resend, lalu tandai saat ditukar di kasir agar tidak dobel klaim.
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
            <h3 className="mb-1.5 text-xs font-bold text-neutral-600">Riwayat &amp; Status Penukaran Voucher Kasir</h3>
            <ul className="divide-y divide-[#EFE6D3] text-xs">
              {giveaways.slice(0, 12).map((g) => (
                <li key={g.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="font-bold">{g.displayName}</span>
                  <span className="text-neutral-500">({g.email})</span>
                  <span>· {g.prizeName}</span>
                  <span className="rounded bg-hg-yellow px-1.5 py-0.5 font-mono text-[11px] font-bold">{g.voucherCode}</span>
                  <span className="text-neutral-500">
                    {g.sentViaResend ? "📧 terkirim" : "📝 lokal"} · {dateShort(g.sentAt)}
                  </span>
                  <button
                    type="button"
                    disabled={redeemBusyId === g.id}
                    onClick={() => void toggleRedeemGiveaway(g.id)}
                    className={`ml-auto rounded border px-2 py-0.5 text-[11px] font-bold ${
                      g.redeemedAt
                        ? "border-emerald-700 bg-emerald-50 text-emerald-900"
                        : "border-[#2b1d17] bg-white text-[#241917] hover:bg-hg-yellow"
                    }`}
                  >
                    {g.redeemedAt ? `✅ Ditukar (${dateShort(g.redeemedAt)})` : "Tandai Ditukar di Kasir"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      {/* 4. LunaPOS Monthly CSV Loyalty Sync */}
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
