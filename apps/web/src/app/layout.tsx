import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Radar Contábil',
  description:
    'Nenhuma obrigação esquecida. Nenhum documento perdido. Nenhum erro fiscal silencioso.',
  icons: {
    icon: '/logo.png', // antena de radar — logo oficial (o robô é o mascote)
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
