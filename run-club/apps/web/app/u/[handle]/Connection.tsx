import { Button, Panel } from "@/components/ui";
import type { Integration } from "@/lib/data/store";
import { dateLong } from "@/lib/format";
import { deleteAccount, disconnectNow, syncNow } from "../../actions";

const NOTE: Record<string, string> = {
  connected: "Tersambung! Lari 12 minggu terakhir sudah ditarik.", denied: "Kamu membatalkan izin di Intervals.icu.",
  expired: "Sesi sambung kedaluwarsa, coba lagi.", failed: "Gagal menyambung ke Intervals.icu. Coba lagi sebentar lagi.",
  sync_failed: "Tersambung, tapi sync pertama gagal. Tekan Sync sekarang.",
};

/** Owner-only: the Intervals.icu connection, sync, and account deletion (SPEC §3, §11). */
export function Connection({ integ, note, handle, welcome }: { integ: Integration | null; note?: string; handle: string; welcome: boolean }) {
  return (
    <Panel title="Sambungan jam (Intervals.icu)">
      {welcome && !integ && <p className="mb-2 font-bold">Langkah terakhir: sambungkan Intervals.icu supaya lari kamu jadi XP.</p>}
      {note && NOTE[note] && <p role="status" className="mb-2 font-bold">{NOTE[note]}</p>}
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
        <a href="/api/intervals/connect" className="inline-block rounded-md border-2 border-black bg-hg-orange px-3 py-1.5 text-sm font-bold text-white shadow-[3px_3px_0_#111]">
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
          <input name="confirm" className="rounded border-2 border-neutral-300 px-2 py-1" aria-label="Ketik username untuk konfirmasi" />
          <Button variant="danger">Hapus permanen</Button>
        </form>
      </details>
    </Panel>
  );
}
