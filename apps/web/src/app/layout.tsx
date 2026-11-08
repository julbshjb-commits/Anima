import type { Metadata, Viewport } from "next";
import { Fraunces, Geist } from "next/font/google";
import "./globals.css";
import { Spotlight } from "@/components/Spotlight";

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
  description: "Retiens tout ce que tu apprends : tes cours deviennent des flashcards, révisées au bon moment. Privé, hébergé en Europe.",
  appleWebApp: { capable: true, title: "Anima", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0D0B11",
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
        <Spotlight />
        {children}
      </body>
    </html>
  );
}
