/** @type {import('next').NextConfig} */
export default {
  poweredByHeader: false,
  serverExternalPackages: ["node:sqlite"],
  async headers() {
    const privateHeaders = [
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
      { key: "Cache-Control", value: "private, no-store" }
    ];
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" }
    ] },
    ...["/", "/admin/:path*", "/api/:path*", "/home/contact"].map(source => ({ source, headers: privateHeaders })),
    // Public pages can be audited locally with their intended indexing policy.
    // Personalized locale/form responses still must not enter shared caches.
    { source: "/home/:path*", headers: [
      { key: "Cache-Control", value: "private, no-store" }
    ] }];
  }
};
