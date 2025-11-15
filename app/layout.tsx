import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Poppins } from 'next/font/google'; // Nova importação
import "./globals.css";

// Definição da fonte Poppins
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Praise FM U.S.",
  description: "Listen live to Praise FM U.S.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-0RNK6G5iWL"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-0RNK6G5iWL');
            `,
          }}
        />
        {/* Font Awesome */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css"
        />
        {/* Preload da fonte Poppins (opcional, mas recomendado) */}
        <link
          rel="preload"
          as="style"
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap"
        />
      </head>
      <body className={poppins.className}> {/* Aplicando a fonte aqui */}
        {children}
      </body>
    </html>
  );
}