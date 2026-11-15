const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  transpilePackages: ["@geiger/ui", "@geiger/notify", "@geiger/pay"],
  basePath: isProd ? '/events' : '',
  allowedDevOrigins: ['127.0.0.1'],
  env: {
    NEXT_PUBLIC_BASE_PATH: isProd ? '/events' : '',
  },
  // QuickJS ships its WASM inside a JS string that bundling turns into an invalid template literal, so it loads as-is.
  serverExternalPackages: ['quickjs-emscripten-core', '@jitl/quickjs-singlefile-cjs-release-sync'],
  // Workspace PDFs read their fonts from disk; every route that can render one (directly or through automations) ships them.
  outputFileTracingIncludes: {
    '/api/events/*/workspace': ['./lib/workspace/documents/fonts/*.ttf'],
    '/api/events/*/workspace/**': ['./lib/workspace/documents/fonts/*.ttf'],
    '/api/portal/workspace/**': ['./lib/workspace/documents/fonts/*.ttf'],
    '/api/v1/workspace/**': ['./lib/workspace/documents/fonts/*.ttf'],
    '/api/internal/workspace/**': ['./lib/workspace/documents/fonts/*.ttf'],
  },
};

export default nextConfig;
