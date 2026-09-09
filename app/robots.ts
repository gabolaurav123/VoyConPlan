export default function robots() {
  return {
    rules: {
      userAgent: '*',
      disallow: ['/admin', '/api', '/viajes', '/cuenta', '/compartir'],
    },
    sitemap: 'https://voyconplan.gabolaurav2.chatgpt.site/sitemap.xml',
  };
}
