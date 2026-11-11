/**
 * The name a picture is filed under in public/art/: the id of the thing, in lower case, with
 * anything that is not a letter or a number turned into a hyphen. The same rule as
 * tools/art/make-art.mjs uses when it saves them.
 */
export const artSlug = (id: string): string => id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
