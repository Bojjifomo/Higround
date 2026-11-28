import type { Metadata, Viewport } from "next";
import { Geist, Pixelify_Sans } from "next/font/google";
import Link from "next/link";
import { PwaAndTelemetry } from "@/components/PwaAndTelemetry";
import { logout } from "./actions";
import { currentMember, isDemo } from "@/lib/data";
import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const pixel = Pixelify_Sans({ variable: "--font-pixel", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Higround Coffee & Run Club",
  description: "Ngopi, lari, nongkrong di dunia pixel Higround Harapan Indah — kumpulin Brew Stamps & Free Drinks!",
  appleWebApp: {
    capable: true,
    title: "Higround",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-180.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#FF5F0E",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const me = await currentMember();
  const staff = me?.role === "admin" || me?.role === "instructor";
  return (
    <html lang="id">
      <body className={`${sans.variable} ${pixel.variable} font-sans antialiased`}>
        <header className="border-b-4 border-black bg-hg-orange text-white">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 sm:gap-x-4 sm:px-4 sm:py-3">
            <Link href="/" className="font-pixel text-xl leading-none tracking-wide sm:text-2xl">HIGROUND <span className="text-hg-yellow">RUN CLUB</span></Link>
            <nav className="ml-auto flex flex-wrap items-center gap-0.5 text-xs font-bold sm:gap-1 sm:text-sm">
              <Link className="rounded px-2 py-1 hover:bg-black/15" href="/world">Dunia</Link>
              <Link className="rounded px-2 py-1 hover:bg-black/15" href="/events">Event</Link>
              {me && <Link className="rounded px-2 py-1 hover:bg-black/15" href="/create">Karakter</Link>}
              {me && <Link className="rounded px-2 py-1 hover:bg-black/15" href="/share">IG Story</Link>}
              {me && <Link className="rounded px-2 py-1 hover:bg-black/15" href={`/u/${me.handle}`}>Profil</Link>}
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
        <PwaAndTelemetry />
        {isDemo() && (
          <div className="bg-hg-yellow px-4 py-1.5 text-center text-xs font-bold text-black">
            Mode demo: data member dan lari di sini palsu dan hilang saat server restart. Isi env Supabase untuk data asli.
          </div>
        )}
        <main className="mx-auto max-w-6xl px-4 py-4">{children}</main>
      </body>
    </html>
  );
}
