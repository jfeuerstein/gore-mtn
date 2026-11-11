// Every piece of generated art in the game, as the words it was made from. The pictures in
// public/art/ come from this file and nowhere else: change a description here and run
// `node tools/art/make-art.mjs` to make it again. Nothing here names the game or its owner.

/**
 * One model and one look for everything, so the pictures sit together. Several were tried; this
 * one keeps a plain paper background and draws the thing asked for, which the others did not.
 */
export const MODEL = 'fal-ai/flux/schnell';
export const LOOK =
  "gouache and coloured pencil illustration in the style of a vintage children's nature field guide, flat muted colours, soft paper grain, simple charming shapes, centered on a plain off-white paper background, nothing else in the picture, no text, no caption, no lettering, no signature";

const person = (who) => `head and shoulders portrait of ${who}, kindly expression, looking at the viewer`;
const stone = (what) => `a single mineral specimen: ${what}`;
const creature = (what) => `${what}, whole body in view, side view`;
const plant = (what) => `${what}, botanical study`;

/** Portraits, 256 px: shown beside what each person says. */
export const PEOPLE_ART = {
  hazel: person('a cheerful woman ski patroller in her forties with a brown ponytail, a red jacket with a white cross on the chest and a red knit beanie, rosy cheeks'),
  otto: person('an old lift attendant with a big grey walrus moustache, a blue work jacket and a mustard yellow fur trapper hat with ear flaps, twinkling eyes'),
  gus: person('a big jolly cook with a bushy brown beard, a white chef jacket and a tall white chef hat'),
  wren: person('a wiry woman forest ranger in her sixties with grey braids, a green jacket and a tan flat-brimmed ranger hat, binoculars hanging round her neck'),
  mica: person('an excitable geologist woman with round glasses and wild curly dark hair under a dark red knit beanie, a purple jacket'),
  bea: person('a dignified elderly woman train conductor with silver hair in a bun, a navy blue uniform with brass buttons and a navy peaked conductor cap'),
  june: person('a young woman baker with freckles and auburn hair, a yellow jacket and a cream knit beanie, a smudge of flour on her cheek'),
  walt: person('a lanky sandwich maker in his fifties with a thin moustache, a green apron over a checked shirt and a white paper cap, a pencil behind his ear, a wry smile'),
  pip: person('a nine year old girl with a gap-toothed grin, a pink ski jacket and a bright yellow pompom hat'),
  dot: person('a brisk postmaster woman in her fifties with short grey hair and reading glasses on a chain, a blue postal uniform jacket and a navy peaked cap, holding a letter'),
  marge: person('a warm no-nonsense innkeeper woman in her sixties with curly red hair, a plum cardigan and a cream knit hat, a dish towel over her shoulder'),
  fenn: person('a gentle elderly librarian man with half-moon glasses and a neat white moustache, a brown tweed jacket and a tan brimmed hat, holding a book'),
  sven: person('a tall cheerful Scandinavian ski instructor man with a blond beard, a green ski jacket and a white knit beanie'),
  bram: person('a broad quiet snow groomer driver man with dark stubble, an orange work jacket and a black fur trapper hat with ear flaps, holding a coffee mug'),
  biscuit: 'head and shoulders portrait of a big friendly Saint Bernard mountain dog with a little wooden barrel on its collar, tongue out, snow on its nose',
  amos: person('a very old retired miner with a long white beard, a weathered tan canvas jacket and a yellow miner hard hat with a lamp on the front'),
};

/** Mineral plates, 384 px: shown in the Book once found. */
export const MINERAL_ART = {
  garnet: stone('almandine garnet, several deep wine-red round faceted crystals embedded in a chunk of dark grey rock'),
  hornblende: stone('hornblende, a chunk of glossy black and very dark green blocky crystals'),
  feldspar: stone('plagioclase feldspar, a blocky cream and pale grey crystal with flat shiny cleavage faces'),
  quartz: stone('quartz, a cluster of clear and milky white six-sided pointed crystals'),
  magnetite: stone('magnetite, a heavy black metallic eight-sided crystal with a small steel nail stuck to it by magnetism'),
  calcite: stone('calcite, pale honey-yellow translucent slanted block-shaped crystals'),
  pyrite: stone("pyrite, fool's gold, a cluster of shiny brassy golden cubes"),
  graphite: stone('graphite, a soft silvery grey flaky lump lying next to a wooden pencil'),
  labradorite: stone('labradorite, a dark grey stone with a broad flash of iridescent blue and green across its polished face'),
  tourmaline: stone('black tourmaline, a bundle of long black grooved column-shaped crystals'),
  wollastonite: stone('wollastonite, a white silky fibrous splintery mineral'),
  'gem-garnet': stone('one flawless cut gem garnet, clear deep red, with many small sparkling facets'),
};

/** Field guide plates, 384 px: shown in the Book once seen. */
export const SPECIES_ART = {
  deer: creature('a white-tailed deer buck with antlers, plain grey-brown coat, standing alert with its white tail raised'),
  fox: creature('a red fox trotting, with black legs and a white-tipped bushy tail'),
  hare: creature('a snowshoe hare in its white winter coat, sitting up, with big furry hind feet'),
  bear: creature('an American black bear walking on all fours, with a tan muzzle'),
  moose: creature('a bull moose with wide palmate antlers, very tall, long legs'),
  otter: creature('a river otter sliding on its belly down a snowbank, looking delighted'),
  beaver: creature('a beaver sitting up gnawing a stick, with a broad flat scaly tail'),
  porcupine: creature('a North American porcupine waddling, covered in long quills'),
  squirrel: creature('an American red squirrel sitting on a spruce branch holding a cone, tail curled up over its back'),
  chipmunk: creature('an eastern chipmunk with striped back and very full cheeks, tail straight up'),
  marten: creature('an American pine marten, a slender dark brown weasel with an orange throat patch, perched on a snowy log'),
  bobcat: creature('a bobcat sitting on a rock ledge, spotted tawny coat, tufted ears, short bobbed tail'),
  raccoon: creature('a raccoon with a black mask and ringed tail, standing on its hind legs holding an apple'),
  coyote: creature('an eastern coyote standing with its head tilted back, howling'),
  chickadee: creature('a black-capped chickadee, a tiny round bird with a black cap and bib and white cheeks, perched on a twig'),
  raven: creature('a common raven, a large glossy black bird with a heavy beak, perched on a rock, beak open'),
  turkey: creature('a wild turkey tom strutting with its tail fanned out'),
  owl: creature('a barred owl with dark eyes and brown and white barred feathers, perched on a branch at night'),
  loon: creature('a common loon swimming, black head, red eye, black and white checkered back'),
  heron: creature('a great blue heron standing still in shallow water on long legs, neck curved'),
  eagle: creature('a bald eagle perched on a bare branch, white head and tail, dark brown body, yellow beak'),
  bluejay: creature('a blue jay with a crest, bright blue, white and black feathers, perched on a branch'),
  grouse: creature('a ruffed grouse, a plump mottled brown bird with a fanned banded tail, standing in snow'),
  grayjay: creature('a Canada jay, a fluffy pale grey bird with a white forehead and dark cap, perched on a spruce twig'),
  hummingbird: creature('a ruby-throated hummingbird hovering at a red flower, green back, glittering red throat'),
  trillium: plant('red trillium wildflower, three dark red petals above three broad green leaves'),
  troutlily: plant('trout lily wildflower, one nodding yellow flower with swept-back petals and two mottled green and brown leaves'),
  fiddlehead: plant('fiddlehead ferns, several young green fern fronds tightly curled like the scroll of a violin'),
  ladyslipper: plant("pink lady's slipper orchid, one pink pouch-shaped flower on a stalk above two broad leaves"),
  daisy: plant('a clump of oxeye daisies, white petals around yellow centres'),
  blueberry: plant('a sprig of wild lowbush blueberries, small dusty blue berries among little green leaves'),
  cattail: plant('cattails, three tall stalks with brown sausage-shaped heads and long blade leaves'),
  goldenrod: plant('goldenrod, tall stems with arching plumes of tiny bright yellow flowers'),
  chanterelle: plant('three chanterelle mushrooms, egg-yolk yellow, trumpet shaped with ridged undersides'),
  flyagaric: plant('two fly agaric toadstools, bright red caps with white spots, white stems'),
  mapleleaf: plant('one perfect red sugar maple leaf in autumn colour'),
  balsamcone: plant('a balsam fir branch with flat green needles and three fat purple-grey fir cones standing upright on top of it'),
  icicles: plant('a row of long blue icicles hanging from a grey rock ledge'),
  birchbark: plant('a curled scroll of white paper birch bark with dark lines on it'),
  snowman: creature('a cheerful lopsided snowman with a carrot nose, stick arms, a red scarf and a black top hat, front view'),
  cairn: plant('a small cairn of flat grey stones stacked one on another, with one little red garnet on the top'),
  rumor: 'a very blurry, out-of-focus picture of a tall shaggy dark sasquatch creature mid-stride between snowy fir trees at dusk, seen from far away, looking back over its shoulder, mysterious but friendly',
};
