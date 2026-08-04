import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Identidade padrão da plataforma; brand pode ser sobrescrita por tenant
        // via CSS variables (white-label, fase pós-MVP)
        // Identidade AZUL (alinhada à paleta validada dos gráficos)
        brand: {
          50: '#eef4fc',
          100: '#d7e6f9',
          500: '#2a78d6',
          600: '#1c5cab',
          700: '#184f95',
          900: '#0d366b',
        },
        status: {
          regular: '#16a34a',
          atencao: '#eab308',
          critico: '#dc2626',
          naoIniciado: '#9ca3af',
          emAndamento: '#2563eb',
        },
      },
    },
  },
  plugins: [],
};

export default config;
