import rail from "../../Rack/res/ComponentLibrary/Rail.svg?raw";

export const dynamic = "force-static";

export async function GET() {
  return new Response(rail, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": "image/svg+xml; charset=utf-8",
    },
  });
}
