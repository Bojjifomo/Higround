import { Button, Panel } from "@/components/ui";
import type { Integration } from "@/lib/data/store";
import { dateLong } from "@/lib/format";
import { deleteAccount, disconnectNow, syncNow } from "../../actions";

const NOTE: Record<string, { text: string; err: boolean }> = {
  connected: { text: "Tersambung! Lari 12 minggu terakhir sudah ditarik.", err: false },
  denied: { text: "Kamu membatalkan izin di Intervals.icu.", err: true },
  expired: { text: "Sesi sambung kedaluwarsa (cookie OAuth hilang/habis). Coba lagi.", err: true },
  duplicate: { text: "Akun Intervals.icu ini sudah tersambung ke member Higround lain.", err: true },
  oauth_error: { text: "OAuth Intervals.icu ditolak atau gagal tukar token. Pastikan kredensial app Intervals.icu & Redirect URI aktif.", err: true },
  config_error: { text: "Konfigurasi INTERVALS_REDIRECT_URI di server belum valid. Hubungi admin.", err: true },
  failed: { text: "Gagal menyimpan sambungan ke Intervals.icu. Coba lagi sebentar lagi.", err: true },
  sync_failed: { text: "Tersambung, tapi sync pertama gagal. Tekan Sync sekarang.", err: true },
};

/** Owner-only: the Intervals.icu connection, sync, and account deletion (SPEC §3, §11). */
export function Connection({
  integ,
  note,
  handle,
  welcome,
  isMock = false,
}: {
  integ: Integration | null;
  note?: string;
  handle: string;
  welcome: boolean;
  isMock?: boolean;
}) {
  const feedback = note ? NOTE[note] : null;
  const profilePath = `/u/${handle}`;
  const connectHref = `/api/intervals/connect?next=${encodeURIComponent(profilePath)}&from=${encodeURIComponent(profilePath)}`;

  return (
    <Panel title="Sambungan jam (Intervals.icu)">
      {welcome && !integ && <p className="mb-2 font-bold">Langkah terakhir: sambungkan Intervals.icu supaya lari kamu jadi XP.</p>}
      {feedback && (
        <p
          role={feedback.err ? "alert" : "status"}
          className={`mb-2 rounded border-2 px-3 py-1.5 text-xs font-bold ${
            feedback.err ? "border-hg-red bg-white text-hg-red" : "border-emerald-700 bg-emerald-50 text-emerald-900"
          }`}
        >
          {feedback.err ? "⚠️ " : "✅ "}
          {feedback.text}
        </p>
      )}
      {isMock && !integ && (
        <p className="mb-2 rounded border border-black/25 bg-hg-yellow/40 px-2.5 py-1.5 text-xs text-neutral-800">
          ℹ️ <b>Mode Simulasi aktif</b> (kredensial OAuth Intervals.icu belum diset di server — klik sambungkan untuk test data lari simulasi).
        </p>
      )}
      {integ ? (
        <div className="space-y-2 text-sm">
          <p>Tersambung sebagai atlet <b>{integ.athleteId}</b>. Sync terakhir: {integ.lastSyncedAt ? dateLong(integ.lastSyncedAt) : "belum"}.</p>
          {integ.syncError && <p className="font-bold text-hg-red">{integ.syncError}</p>}
          <div className="flex flex-wrap gap-2">
            <form action={syncNow}><Button>Sync sekarang</Button></form>
            <form action={disconnectNow}><Button variant="danger">Putuskan &amp; hapus data lari</Button></form>
          </div>
        </div>
      ) : (
        <a href={connectHref} className="inline-block rounded-md border-2 border-black bg-hg-orange px-3 py-1.5 text-sm font-bold text-white shadow-[3px_3px_0_#111] hover:brightness-105">
          Sambungkan Intervals.icu
        </a>
      )}
      <p className="mt-3 text-xs text-neutral-600">
        Sambungkan jam kamu (Garmin, COROS, Polar, Suunto, Wahoo) <b>langsung</b> ke Intervals.icu. Lari yang masuk lewat
        Strava tidak bisa dibaca karena aturan Strava.
      </p>
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-hg-red">Hapus akun</summary>
        <form action={deleteAccount} className="mt-2 flex flex-wrap items-center gap-2">
          <span>Ketik <b>{handle}</b> untuk menghapus akun, semua lari, XP, dan klaim yoga secara permanen:</span>
          <input name="confirm" className="rounded border-2 border-neutral-300 px-2 py-1" aria-label="Ketik ID profil untuk konfirmasi" />
          <Button variant="danger">Hapus permanen</Button>
        </form>
      </details>
    </Panel>
  );
}
