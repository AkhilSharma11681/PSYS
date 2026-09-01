import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import NavLinks from "@/lib/NavLinks";
import UserMenu from "@/lib/UserMenu";
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
  let fullName: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role, full_name')
      .eq('id', user.id)
      .single();
    if (profile) {
      role = profile.role;
      fullName = profile.full_name;
    }
  }

  const userInfo = user ? {
    name: fullName,
    email: user.email ?? null,
    role,
  } : null;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col">
        <nav
          className="border-b px-6 py-3 flex items-center justify-between text-sm sticky top-0 z-10"
          style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          <NavLinks role={role} />
          <UserMenu user={userInfo} />
        </nav>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
