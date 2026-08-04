/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build standalone: imagem Docker mínima (não precisa de node_modules completos)
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
