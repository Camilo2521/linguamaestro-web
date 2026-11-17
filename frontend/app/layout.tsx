import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_JP, Noto_Sans_SC } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const notoJP = Noto_Sans_JP({
  subsets: ['latin'],
  variable: '--font-noto-jp',
  display: 'swap',
  weight: ['400', '500', '700'],
});

const notoSC = Noto_Sans_SC({
  subsets: ['latin'],
  variable: '--font-noto-sc',
  display: 'swap',
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = {
  title: { default: 'LinguaMaestro', template: '%s — LinguaMaestro' },
  description: 'Aprende idiomas con niveles CEFR y método científico. Resultados reales.',
  keywords: ['idiomas', 'aprender inglés', 'CEFR', 'cursos de idiomas', 'repetición espaciada'],
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    siteName: 'LinguaMaestro',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0C0E1A',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${notoJP.variable} ${notoSC.variable}`}
      data-scroll-behavior="smooth"
    >
      <body className="font-body bg-[var(--color-bg-base)] text-[var(--color-text-primary)] antialiased">
        <QueryProvider>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
