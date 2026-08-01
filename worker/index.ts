import { GET as resolveLibraryModule } from "../server/api/library-resolve";
import { GET as rackComponent } from "../server/api/rack-component";
import { GET as rackRail } from "../server/api/rack-rail";

interface Env {
  ASSETS: Fetcher;
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/api/library/resolve") return resolveLibraryModule(request);
    if (pathname === "/api/rack-component") return rackComponent(request);
    if (pathname === "/api/rack-rail") return rackRail();
    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "API route not found" }, { status: 404 });
    }
    return env.ASSETS.fetch(request);
  },
};

export default worker;
