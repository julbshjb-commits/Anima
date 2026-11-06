import type { Metadata, Viewport } from "next";
import { Fraunces, Geist } from "next/font/google";
import "./globals.css";

// Direction « Anima vivante » : une serif ronde et douce (axe SOFT) pour les titres,
// une sans nette pour l'interface.
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "opsz"],
});

const geist = Geist({ variable: "--font-ui", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Anima", template: "%s · Anima" },
  description: "Ton journal intime et vos journaux partagés. Privé par défaut, hébergé en Europe.",
  appleWebApp: { capable: true, title: "Anima", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#F3EFE8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <div className="aura" aria-hidden>
          <i />
          <i />
          <i />
        </div>
        {children}
      </body>
    </html>
  );
}
