/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/generate',
        destination: 'http://localhost:4000/generate',
      },
    ];
  },
};

export default nextConfig;
