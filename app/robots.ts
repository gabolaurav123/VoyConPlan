export default function robots() {
  return {
    rules: {
      userAgent: '*',
      disallow: [
        '/admin',
        '/api',
        '/viajes',
        '/cuenta',
        '/compartir',
        '/entrar',
        '/crear-cuenta',
        '/configurar-admin',
      ],
    },
    sitemap:
      (process.env.APP_ORIGIN || 'http://localhost:3000') + '/sitemap.xml',
  };
}
