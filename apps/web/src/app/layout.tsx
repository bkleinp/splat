import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Splat Homes",
  description: "Walk through a home in 3D and ask about it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            Splat Homes
          </Link>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
