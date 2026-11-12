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

/**
 * The way the things people have made are modelled (a shack, a tent, a lantern on a post):
 * the same chunky picture, painted through fal, and a shape of it from Tripo's model as fal
 * serves it. A model asks for it with `by: 'fal-tripo'`. The owner asked for these after
 * finding the same things built from blocks too blocky beside the animals.
 */
export const FAL_TRIPO = {
  image: 'fal-ai/gpt-image-1.5',
  shape: 'tripo3d/h3.1/image-to-3d',
  look: 'as a chunky low poly toy model: a few thick, stout, solid shapes joined into one piece, nothing thin or spindly, every post and leg fat, flat matte colours with no gradients and no texture, seen from the front and a little to one side and above, the whole thing in view with space round it, standing on nothing, on a plain white background, soft even light, no shadow, no text, no lettering',
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
  ladyslipper: { what: "a pink lady's slipper orchid growing from a small mound of earth: two broad green leaves and one pink pouch-shaped flower on a stem", inks: 'plant', by: 'tripo' },
  daisy: { what: 'a clump of oxeye daisies growing from a small mound of grass: white petals, yellow centres, green stems and leaves', inks: 'plant' },
  blueberry: { what: 'a low wild blueberry bush, a rounded mound of small green leaves with clusters of dark blue berries', inks: 'plant', by: 'tripo' },
  cattail: { what: 'a clump of cattails growing from a small mound of mud: tall green reed leaves and four brown sausage-shaped seed heads', inks: 'plant', by: 'tripo' },
  goldenrod: { what: 'a clump of goldenrod growing from a small mound of earth: green leafy stems topped with thick plumes of bright yellow flowers', inks: 'plant', by: 'tripo' },
  chanterelle: { what: 'a cluster of three golden-orange chanterelle mushrooms with wavy caps, growing from a small mound of green moss', inks: 'plant' },
  flyagaric: { what: 'two fly agaric mushrooms, one tall and one small, bright red caps with white spots, thick white stems, on a small mound of earth', inks: 'plant' },
  mapleleaf: { what: 'one large red and orange maple leaf with a little curl to it, lying on a small flat mound of earth', inks: 'plant' },
  balsamcone: { what: 'a short bough of balsam fir with green needles and three purple cones standing upright on it', inks: 'plant', by: 'tripo' },
  birchbark: { what: 'a thick curl of white birch bark with black marks, peeled from a log, lying on the ground', by: 'tripo' },
  cairn: { what: "a hiker's cairn: a neat stack of six flat grey stones, largest at the bottom, smallest on top" },
  snowman: { what: 'a small friendly snowman of three snowballs with stick arms, a carrot nose, coal eyes and a red scarf', inks: 'plant' },
  // Not of the field guide: the dog at the Saddle Lodge and the cat who is mayor, by the id each has among the people.
  biscuit: { what: 'a big fluffy mountain rescue dog sitting upright, white with large brown patches and brown ears, a small wooden barrel hanging from its collar', turn: 0, by: 'tripo' },
  pickles: { what: 'a fat orange tabby cat sitting very upright and dignified, with a cream chest, wearing a gold chain of office with a round medallion', inks: 'plant', turn: 0, by: 'tripo' }, // the plants' inks have the orange a ginger cat wants
  // Things people have made, out on the mountain: the secrets, and what stands beside the people who roam.
  // They are printed in the game's own inks (`made`, the default for these), and cut down to `faces` triangles: more for a building, fewer for a post.
  'thing-register': { what: 'a trail register: a grey tin box with a sloping dark lid, mounted on top of a short thick wooden post, a small white paper label on the front of the box', faces: 600, by: 'fal-tripo' },
  'thing-plaque': { what: 'a trailside plaque: a thick rectangular plate of bright golden yellow brass with three dark engraved lines across it, tilted back like a lectern on top of a short thick dark brown wooden post', faces: 900, turn: 90, by: 'fal-tripo' },
  'thing-bell': { what: "an old green-bronze ship's bell hanging in a sturdy timber frame of two thick posts and a crossbeam, a short thick rope hanging down from inside the bell", faces: 1100, turn: 90, by: 'fal-tripo' },
  'thing-adit': { what: 'the entrance to an old mine tunnel set into a mound of grey rock: a dark opening framed by two thick timber posts and a lintel, a small rusty ore cart full of dark red stones on short rails in front of it', faces: 1800, turn: 90, by: 'fal-tripo' },
  'thing-cellar': { what: 'an old cellar hole: a low square ruin of four thick fieldstone walls, open to the sky, with a gap in the front wall where the door was, green moss on the stones, and a small gnarled apple tree with a few red apples growing at one corner', faces: 1800, by: 'fal-tripo' },
  'thing-rope-tow': { what: 'an old ski rope tow engine: a rusty red truck engine mounted on a sled of two thick timbers, with one big dark iron pulley wheel standing upright on its side and a thick rope round the wheel', faces: 1600, by: 'fal-tripo' },
  'thing-den': { what: 'a fox den: a rounded mound of brown earth and green moss with a dark round burrow hole in its front, and a fallen white birch log with black marks lying across the top of the mound, its roots sticking up at one end', faces: 1400, turn: 90, by: 'fal-tripo' },
  'thing-den-snow': { what: 'a fox den in winter: a rounded mound covered in thick white snow with a dark round burrow hole in its front, and a fallen white birch log with black marks lying across the top of the mound, its dark roots sticking up at one end', against: 'sky blue', faces: 1400, turn: 90, by: 'fal-tripo' },
  'thing-nest': { what: "a duck's nest on a small mound of mud: a round bowl of woven dry reeds lined with white down, three pale eggs in it, with a clump of thick green reeds and two brown cattails standing behind it", faces: 1200, turn: 90, by: 'fal-tripo' },
  'thing-shack': { what: 'a small maple sugar shack: brown plank walls, a plank door and one square window in the front, a pitched grey tin roof with a raised steam vent along its ridge, a short black stovepipe, and a neat stack of firewood against one side wall', faces: 2000, turn: 90, by: 'fal-tripo' },
  'thing-shack-snow': { what: 'a small maple sugar shack in winter: brown plank walls, a plank door and one square window in the front, a pitched roof under thick white snow with a raised steam vent along its ridge, a short black stovepipe, and a neat stack of firewood with snow on top against one side wall', against: 'sky blue', faces: 2000, turn: 90, by: 'fal-tripo' },
  'thing-ribbon': { what: 'the lower trunk of a white birch tree with black marks, sawn off flat at the top, with a wide bright orange ribbon tied round its middle in a knot, the two ends of the ribbon hanging down', against: 'sky blue', faces: 500, by: 'fal-tripo' },
  'thing-lantern': { what: 'an old black iron lantern with warm yellow glass sides, hanging from the curved arm at the top of a thick black iron post', faces: 1000, by: 'fal-tripo' },
  'thing-maple': { what: 'the thick grey-brown trunk of a bare sugar maple tree with three short stubby branch stumps near the top, and a grey metal sap bucket with a lid hanging on the trunk at waist height', faces: 700, turn: 90, by: 'fal-tripo' },
  'thing-easel': { what: "a painter's wooden easel holding a small landscape painting of blue hills and green woods, with a little three-legged wooden stool beside it and an open box of paints on the stool", faces: 1200, turn: 90, by: 'fal-tripo' },
  'thing-tent': { what: 'a small old-fashioned canvas A-frame tent, cream coloured with a red ridge pole, its front door flaps tied open showing the dark inside', faces: 900, turn: 270, by: 'fal-tripo' },
  'thing-campfire': { what: 'a campfire: a ring of round grey stones with crossed logs and chunky orange and yellow flames in the middle, a short thick log to sit on beside it, and a black coffee pot standing by the stones', faces: 1300, by: 'fal-tripo' },
  'thing-stand': { what: 'a black music stand with a thick post and a wide three-footed base, holding an open book of sheet music', faces: 700, turn: 270, by: 'fal-tripo' },
  // What comes along with the player, by the id each has in the wardrobe: small, round and young.
  'pet-kit': { what: 'a baby red fox cub standing on all fours, chubby, big head, big pointed ears, orange fur, white chest, bushy tail with a white tip', inks: 'plant' },
  'pet-duckling': { what: 'a fluffy yellow duckling standing, round body, big head, orange beak and feet', inks: 'bird' },
  'pet-kitten': { what: 'a small grey tabby kitten sitting upright, round head, big ears, white paws and chest' },
  'pet-toad': { what: 'a fat brown toad sitting, bumpy back, cream belly, wide mouth', inks: 'plant' },
};
