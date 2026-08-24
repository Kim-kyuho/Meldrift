import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Meldrift",
  description: "Meld your ideas. Drift into clarity.",
  icons: {
    icon: "/favicon.ico?v=4",
    apple: "/apple-touch-icon.png?v=4",
  },
  verification: {
    google: "dpSt4TpSHhlxO_UeP3ICnviXTVueVG-wwTtg_xQ4CyU",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
