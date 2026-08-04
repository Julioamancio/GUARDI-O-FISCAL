import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Guardião Fiscal',
  description:
    'Nenhuma obrigação esquecida. Nenhum documento perdido. Nenhum erro fiscal silencioso.',
  icons: {
    icon: '/mascote.png', // mascote oficial do projeto
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
