declare module "cloudflare:workers" {
  export const env: {
    DB?: Parameters<typeof import("drizzle-orm/d1").drizzle>[0];
  };
}

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface D1Database {
  readonly __d1DatabaseBrand?: unique symbol;
}
