import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/providers";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VenueFlow — Convention & Hall Management",
  description: "Manage bookings, payments, staff, and events for convention halls and party venues.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
        <div id="google_translate_element" className="gt-hidden" />

        <Script id="gt-init" strategy="afterInteractive">{`
          function googleTranslateElementInit() {
            new google.translate.TranslateElement(
              { pageLanguage: 'en', includedLanguages: 'te,en,hi,ta', autoDisplay: false },
              'google_translate_element'
            );
          }

          // Sync fixed sidebar top with the GT toolbar height Google sets on body
          new MutationObserver(function() {
            var offset = document.body.style.top || '0px';
            var sidebar = document.querySelector('aside');
            if (sidebar) sidebar.style.top = offset;
          }).observe(document.body, { attributes: true, attributeFilter: ['style'] });
        `}</Script>
        <Script
          src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
