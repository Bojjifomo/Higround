import type { Metadata } from "next";
import { Geist, Pixelify_Sans } from "next/font/google";
import Link from "next/link";
import { logout } from "./actions";
import { currentMember, isDemo } from "@/lib/data";
import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const pixel = Pixelify_Sans({ variable: "--font-pixel", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Higround Run Club",
  description: "Lari, yoga, dan XP di Higround Harapan Indah.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const me = await currentMember();
  const staff = me?.role === "admin" || me?.role === "instructor";
  return (
    <html lang="id">
      <body className={`${sans.variable} ${pixel.variable} font-sans antialiased`}>
        <header className="border-b-4 border-black bg-hg-orange text-white">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <Link href="/" className="font-pixel text-2xl leading-none tracking-wide">HIGROUND <span className="text-hg-yellow">RUN CLUB</span></Link>
            <nav className="ml-auto flex flex-wrap items-center gap-1 text-sm font-bold">
              {me && <Link className="rounded px-2 py-1 hover:bg-black/15" href={`/u/${me.handle}`}>Profil</Link>}
              {me && <Link className="rounded px-2 py-1 hover:bg-black/15" href="/yoga">Yoga Quest</Link>}
              {me?.role === "admin" && <Link className="rounded px-2 py-1 hover:bg-black/15" href="/admin">Admin</Link>}
              {staff && <Link className="rounded px-2 py-1 hover:bg-black/15" href="/admin/class">Class Mode</Link>}
              {me ? (
                <form action={logout}><button className="rounded px-2 py-1 hover:bg-black/15">Keluar</button></form>
              ) : (
                <Link className="rounded bg-black px-3 py-1 hover:bg-black/80" href="/login">Masuk</Link>
              )}
            </nav>
          </div>
        </header>
        {isDemo() && (
          <div className="bg-hg-yellow px-4 py-1.5 text-center text-xs font-bold text-black">
            Mode demo: data member dan lari di sini palsu. Supabase dan Intervals.icu belum disambungkan.
          </div>
        )}
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
