import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Prospección IA',
  description: 'Sistema de prospección y generación de demos comerciales'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
