const PATCHSTORAGE_HOSTS = new Set(["patchstorage.com", "www.patchstorage.com"]);
const PATCHSTORAGE_UPLOAD_PREFIX = "/wp-content/uploads/";

function decodeHtmlAttribute(value: string) {
  return value.replace(
    /&(?:amp|quot|apos|#39|#x27|#(\d+)|#x([\da-f]+));/gi,
    (entity, decimal: string | undefined, hexadecimal: string | undefined) => {
      if (decimal) return String.fromCodePoint(Number.parseInt(decimal, 10));
      if (hexadecimal) return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
      if (entity.toLowerCase() === "&amp;") return "&";
      if (entity.toLowerCase() === "&quot;") return '"';
      return "'";
    },
  );
}

function attributeFromTag(tag: string, name: string) {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"),
  );
  const value = match?.[1] ?? match?.[2] ?? match?.[3];
  return value === undefined ? undefined : decodeHtmlAttribute(value);
}

function isPatchStorageHost(hostname: string) {
  return PATCHSTORAGE_HOSTS.has(hostname.toLowerCase());
}

export function parsePatchStoragePageUrl(requested: string) {
  let url: URL;
  try {
    url = new URL(requested.trim());
  } catch {
    throw new Error("Enter a complete PatchStorage HTTPS link");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (
    url.protocol !== "https:" ||
    !isPatchStorageHost(url.hostname) ||
    url.username ||
    url.password ||
    url.port ||
    parts.length !== 1 ||
    !/^[a-z0-9][a-z0-9-]*$/i.test(parts[0])
  ) {
    throw new Error("Expected a PatchStorage patch link like https://patchstorage.com/example/");
  }
  return new URL(`https://patchstorage.com/${parts[0]}/`);
}

export function parsePatchStorageDownloadUrl(requested: string, pageUrl: URL) {
  const url = new URL(requested, pageUrl);
  if (
    url.protocol !== "https:" ||
    !isPatchStorageHost(url.hostname) ||
    url.username ||
    url.password ||
    url.port ||
    !url.pathname.startsWith(PATCHSTORAGE_UPLOAD_PREFIX) ||
    !url.pathname.toLowerCase().endsWith(".vcv")
  ) {
    throw new Error("This PatchStorage page does not provide a direct .vcv download");
  }
  return url;
}

export function parsePatchStorageDownloadHtml(html: string, pageUrl: URL) {
  for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
    const tag = match[0];
    const className = attributeFromTag(tag, "class") ?? "";
    if (!className.split(/\s+/).includes("ps-patch-download")) continue;
    const href = attributeFromTag(tag, "href");
    if (!href) break;
    return parsePatchStorageDownloadUrl(href, pageUrl);
  }
  throw new Error("PatchStorage did not expose a downloadable .vcv file on this page");
}

export function patchStorageFilename(downloadUrl: URL) {
  const encoded = downloadUrl.pathname.split("/").pop() ?? "PatchStorage.vcv";
  let decoded: string;
  try {
    decoded = decodeURIComponent(encoded);
  } catch {
    decoded = encoded;
  }
  const safe = decoded.replace(/[\\/\r\n\0"]/g, "-").trim();
  return safe && safe.toLowerCase().endsWith(".vcv") ? safe : "PatchStorage.vcv";
}
