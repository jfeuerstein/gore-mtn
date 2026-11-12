// Every generated 3D model in the game, as the words it was made from. A picture is painted
// from the words, a model is made from the picture, and tools/models/convert.py turns that into
// something the game can draw. Nothing here names the game or its owner.

/** The model that paints the picture, and the one that makes a shape of it. */
export const IMAGE_MODEL = 'fal-ai/flux/schnell';
export const SHAPE_MODEL = 'fal-ai/trellis';

/** How every picture is asked for: one thing, whole, side on, in flat light, so that a shape can be made of it. */
export const SHAPE_LOOK =
  'a cute low poly 3D model, flat shaded facets, simple chunky shapes, matte natural colours, the whole thing in view, side view facing left, on a plain white background, soft even studio light, no shadow, no ground';

/**
 * The other way of making a model, for the things the first way makes badly (a clump of thin
 * stems comes back as shards): Tripo paints a chunky picture of it and makes a shape of that
 * picture. A model asks for it with `by: 'tripo'`. About 40 credits each.
 */
export const TRIPO = {
  image: 'chat_image_2.5_flare',
  shape: 'v3.1-20260211',
  look: 'as a chunky low poly toy model: a few thick, stout, solid shapes joined into one piece, nothing thin or spindly, fat stems, big simple leaves, flat matte colours with no gradients, seen from the side and a little above, the whole thing in view with space round it, on a plain white background, soft even light, no shadow, no text',
  turn: 180,
};

/** The looks each model is converted into: see tools/models/convert.py, which can make others (faceted, smooth) to try. */
export const LOOKS = ['park'];

/**
 * Animals of the field guide, by species id. `turn` is degrees about upright to face it front,
 * if it came out facing some other way than most do. `by: 'tripo'` has Tripo make it (see `TRIPO`).
 */
export const MODELS = {
  deer: { what: 'a white-tailed deer buck with antlers, standing' },
  fox: { what: 'a red fox standing, with black legs and a white-tipped bushy tail' },
  bear: { what: 'an American black bear standing on all fours' },
  moose: { what: 'a bull moose with wide antlers, standing' },
  otter: { what: 'a river otter standing on all fours, long body and thick tail' },
  beaver: { what: 'a beaver on all fours with a broad flat tail' },
  porcupine: { what: 'a North American porcupine on all fours, covered in quills' },
  squirrel: { what: 'a red squirrel sitting up with its bushy tail curled over its back' },
  raccoon: { what: 'a raccoon on all fours with a black mask and a ringed tail' },
  coyote: { what: 'an eastern coyote standing', turn: 90 },
  bobcat: { what: 'a bobcat standing, spotted tawny coat, tufted ears, short tail', turn: 90 },
  marten: { what: 'an American pine marten standing on all fours, dark brown with an orange throat' },
  turkey: { what: 'a wild turkey tom with its tail fanned out' },
  owl: { what: 'a barred owl perched upright, brown and white barred feathers, dark eyes' },
  eagle: { what: 'a bald eagle perched upright, white head and tail, dark brown body, yellow beak' },
  heron: { what: 'a great blue heron standing on long legs, neck curved', turn: 90 },
  // The rest of the field guide. `inks` says which inks a model may be printed in: an animal's
  // earths by default; a bird's, which add blue, red and yellow; or a plant's, which add greens
  // and the colours of flowers. A plant grows from a little mound, so that it stands as one piece.
  hare: { what: 'a snowshoe hare sitting, brown summer coat, long ears, big hind feet' },
  // White on white comes back as a wall with a hare carved in it: it is painted against blue instead.
  'hare-white': { what: 'a snowshoe hare sitting, pure white winter coat, long ears with black tips, big hind feet', against: 'sky blue' },
  chipmunk: { what: 'an eastern chipmunk sitting up on its haunches, tan with dark and cream stripes down its back, full cheeks' },
  chickadee: { what: 'a black-capped chickadee perched, round body, black cap and bib, white cheeks, grey back, buff sides', inks: 'bird' },
  raven: { what: 'a raven standing, glossy black all over, heavy beak, shaggy throat', inks: 'bird' },
  loon: { what: 'a common loon resting low as if floating, black head, red eye, black and white checkered back, white breast, flat underside', inks: 'bird' },
  bluejay: { what: 'a blue jay perched, blue crest and back, white face and belly, black necklace, barred blue wings', inks: 'bird' },
  grouse: { what: 'a ruffed grouse standing, plump, mottled brown and grey, small crest, banded tail fanned out', inks: 'bird' },
  grayjay: { what: 'a Canada jay perched, fluffy pale grey body, white forehead and throat, dark grey cap at the back of the head', inks: 'bird' },
  hummingbird: { what: 'a ruby-throated hummingbird perched on a short twig, shiny green back, bright red throat, white belly, long thin beak', inks: 'plant' },
  trillium: { what: 'a red trillium plant growing from a small mound of earth: three broad green leaves and one dark red flower with three petals', inks: 'plant', by: 'tripo' },
  troutlily: { what: 'a trout lily plant growing from a small mound of earth: two green leaves mottled with brown and one nodding yellow flower', inks: 'plant', by: 'tripo' },
  fiddlehead: { what: 'a clump of fiddlehead ferns growing from a small mound of earth: five thick green fern shoots curled into spirals at the top', inks: 'plant', by: 'tripo' },
  ladyslipper: { what: "a pink lady's slipper orchid growing from a small mound of earth: two broad green leaves and one pink pouch-shaped flower on a stem", inks: 'plant' },
  daisy: { what: 'a clump of oxeye daisies growing from a small mound of grass: white petals, yellow centres, green stems and leaves', inks: 'plant' },
  blueberry: { what: 'a low wild blueberry bush, a rounded mound of small green leaves with clusters of dark blue berries', inks: 'plant', by: 'tripo' },
  cattail: { what: 'a clump of cattails growing from a small mound of mud: tall green reed leaves and four brown sausage-shaped seed heads', inks: 'plant', by: 'tripo' },
  goldenrod: { what: 'a clump of goldenrod growing from a small mound of earth: green leafy stems topped with thick plumes of bright yellow flowers', inks: 'plant', by: 'tripo' },
  chanterelle: { what: 'a cluster of three golden-orange chanterelle mushrooms with wavy caps, growing from a small mound of green moss', inks: 'plant' },
  flyagaric: { what: 'two fly agaric mushrooms, one tall and one small, bright red caps with white spots, thick white stems, on a small mound of earth', inks: 'plant' },
  mapleleaf: { what: 'one large red and orange maple leaf with a little curl to it, lying on a small flat mound of earth', inks: 'plant' },
  balsamcone: { what: 'a short bough of balsam fir with green needles and three purple cones standing upright on it', inks: 'plant' },
  birchbark: { what: 'a thick curl of white birch bark with black marks, peeled from a log, lying on the ground', by: 'tripo' },
  cairn: { what: "a hiker's cairn: a neat stack of six flat grey stones, largest at the bottom, smallest on top" },
  snowman: { what: 'a small friendly snowman of three snowballs with stick arms, a carrot nose, coal eyes and a red scarf', inks: 'plant' },
};
