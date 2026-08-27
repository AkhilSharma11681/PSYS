import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import NavLinks from "@/lib/NavLinks";
import LogoutButton from "@/lib/LogoutButton";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PSYS",
  description: "Multi-tenant classroom attendance via face recognition",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <nav
          className="border-b px-6 py-3 flex items-center justify-between text-sm sticky top-0 z-10"
          style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          <NavLinks />
          <LogoutButton />
        </nav>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
