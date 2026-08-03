/**
 * Source-boundary tests should describe architecture, not formatter output.
 * Keep the original text for human-facing strings and append a whitespace-free
 * view so structural assertions survive harmless reformatting.
 */
const SOURCE_VARIANT_SEPARATOR = "\0";

export function searchableSource(source: string): string {
  const compact = source.replace(/\s+/g, ""),
    normalized = compact
      .replace(/\(([A-Za-z_$][\w$]*)\)=>/g, "$1=>")
      .replace(/([,:\[{=(])0\.(\d+)/g, "$1.$2")
      .replace(/,([)\]}])/g, "$1");
  return [source, compact, normalized].join(SOURCE_VARIANT_SEPARATOR);
}

export function countSourceMatches(source: string, pattern: RegExp): number {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return Math.max(
    ...source
      .split(SOURCE_VARIANT_SEPARATOR)
      .map((variant) => variant.match(new RegExp(pattern.source, flags))?.length ?? 0),
  );
}
