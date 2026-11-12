/**
 * A name from the map, tidied for showing: the map's names are kept as they are, but a few
 * were typed in a hurry. This closes up doubled spaces, puts a space before a bracket and
 * round a slash, and mends one doubled letter. It never changes which trail a name means.
 * The save reads its trail names through the same tidying, so a stamp earned under the old
 * spelling is kept. No three.js here.
 */
export function tidyName(name: string): string {
  return name
    .replace(/\s+/g, ' ')
    .replace(/(\S)\(/g, '$1 (')
    .replace(/\s*\/\s*(?![^(]*\))/g, ' / ')
    .replace(/Barrell/g, 'Barrel')
    .trim();
}
