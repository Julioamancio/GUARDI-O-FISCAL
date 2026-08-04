import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Identidade padrão da plataforma; brand pode ser sobrescrita por tenant
        // via CSS variables (white-label, fase pós-MVP)
        brand: {
          50: '#eef7f2',
          100: '#d5ecdf',
          500: '#1a7f56',
          600: '#146a47',
          700: '#0f5438',
          900: '#08301f',
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
