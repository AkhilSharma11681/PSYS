import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import NavLinks from "@/lib/NavLinks";
import LogoutButton from "@/lib/LogoutButton";
import { createClient } from "@/lib/supabase/server";
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let role = "admin"; // defaults to admin so fallback logic in NavLinks works
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profile) {
      role = profile.role;
    }
  }

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
          <NavLinks role={role} />
          <LogoutButton />
        </nav>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
