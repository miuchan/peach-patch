import {
  parsePatchStorageDownloadHtml,
  parsePatchStorageDownloadUrl,
  parsePatchStoragePageUrl,
  patchStorageFilename,
} from "../../lib/patchstorage.ts";

const MAX_PATCH_BYTES = 25 * 1024 * 1024;

function upstreamError(response: Response, label: string) {
  return new Error(`${label} returned ${response.status}`);
}

export async function GET(request: Request) {
  try {
    const requested = new URL(request.url).searchParams.get("url");
    if (!requested) {
      return Response.json({ error: "Missing PatchStorage patch URL" }, { status: 400 });
    }

    const pageUrl = parsePatchStoragePageUrl(requested);
    const pageResponse = await fetch(pageUrl, {
      headers: { accept: "text/html", "user-agent": "Peach Patch/0.1" },
    });
    if (!pageResponse.ok) throw upstreamError(pageResponse, "PatchStorage page");
    if (pageResponse.url) parsePatchStoragePageUrl(pageResponse.url);

    const downloadUrl = parsePatchStorageDownloadHtml(await pageResponse.text(), pageUrl);
    const patchResponse = await fetch(downloadUrl, {
      headers: { accept: "application/octet-stream", "user-agent": "Peach Patch/0.1" },
    });
    if (!patchResponse.ok) throw upstreamError(patchResponse, "PatchStorage download");
    if (patchResponse.url) parsePatchStorageDownloadUrl(patchResponse.url, pageUrl);

    const declaredLength = Number(patchResponse.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_PATCH_BYTES) {
      throw new Error("The PatchStorage patch is larger than the 25 MB import limit");
    }
    const patch = await patchResponse.arrayBuffer();
    if (patch.byteLength > MAX_PATCH_BYTES) {
      throw new Error("The PatchStorage patch is larger than the 25 MB import limit");
    }

    const filename = patchStorageFilename(downloadUrl);
    return new Response(patch, {
      headers: {
        "cache-control": "public, max-age=300",
        "content-disposition": `attachment; filename="${filename}"`,
        "content-type": "application/octet-stream",
        "x-patch-filename": filename,
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not load the PatchStorage patch" },
      { status: 400 },
    );
  }
}
