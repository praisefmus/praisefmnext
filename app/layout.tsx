import "./globals.css";

export const metadata = {
  title: "Praise FM U.S. | Live Radio",
  description: "24/7 Christian Radio Live Stream with song info, album art, and lyrics.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gray-100 dark:bg-gray-900">
        {children}
      </body>
    </html>
  );
}
