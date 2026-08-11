import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Uni.hub — Your Campus. Connected.",
  description: "The all-in-one campus super app: errands, marketplace, wallet, study hub, events and communities.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0A0F1E",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-hub-bg min-h-screen antialiased">
        <div className="mx-auto max-w-md min-h-screen relative">{children}</div>
      </body>
    </html>
  );
}
