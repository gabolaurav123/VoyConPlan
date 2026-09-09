import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
const sans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const mono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
export const metadata: Metadata = {
  title: {
    default: 'VoyConPlan — Tu viaje, con plan.',
    template: '%s | VoyConPlan',
  },
  description:
    'Descubre hasta dónde puedes viajar con tu presupuesto. Organiza tu itinerario, gastos y preparativos en un solo lugar.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/brand/app-icon.png', apple: '/brand/app-icon.png' },
  metadataBase: new URL(process.env.APP_ORIGIN || 'http://localhost:3000'),
  openGraph: {
    title: 'VoyConPlan — Tu viaje, con plan.',
    description: 'Descubre destinos por presupuesto y organiza tu viaje.',
    images: [{ url: '/brand/social-cover.png', width: 1774, height: 887 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VoyConPlan — Tu viaje, con plan.',
    images: ['/brand/social-cover.png'],
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={sans.variable + ' ' + mono.variable}>{children}</body>
    </html>
  );
}
