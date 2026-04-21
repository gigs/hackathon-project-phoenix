import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Phoenix — Customer Dashboard",
  description: "Centralised customer view for Gigs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <Header />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-sage-200 bg-white px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-central-600 text-sm font-extrabold text-white">
          P
        </div>
        <span className="text-sm font-bold text-sage-900">Phoenix</span>
      </div>
      <nav className="flex items-center gap-4">
        <a
          href="/"
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-sage-600 transition hover:bg-sage-75 hover:text-sage-900"
        >
          Portfolio
        </a>
      </nav>
    </header>
  );
}
