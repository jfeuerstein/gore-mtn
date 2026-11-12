// Every piece of generated art in the game, as the words it was made from. The pictures in
// public/art/ come from this file and nowhere else. Portraits, postcards, title pictures and
// shop-sign pictures are painted one at a time (`node tools/art/make-art.mjs`); everything in
// the Book that is had or found is an embroidered patch, made a sheet at a time
// (`node tools/art/make-patches.mjs`) from what each entry here says is sewn on it. Change a
// description and run the tool with `--redo` to make it again. Nothing here names the game or
// its owner.

/**
 * The model and the look for what is painted one at a time, so the pictures sit together.
 * Several were tried; this one keeps a plain paper background and draws the thing asked for.
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
  tom: 'head and shoulders portrait of a dignified snowman with coal eyes, a carrot nose, a black top hat with a cream band and a long striped knitted scarf, a faintly worried expression',
  flurry: person('a theatrical older woman fortune teller with wild grey curls, a purple quilted jacket, a fringed shawl and a mustard yellow knit beanie, one eyebrow raised, holding a snow globe'),
  ivy: person('a calm capable ski patrol woman with a dark braid, a red ski patrol jacket with a white cross and a red ski helmet with goggles pushed up, holding a green thermos'),
  pickles: 'head and shoulders portrait of a fat, solemn orange tabby cat wearing a tiny gold mayoral chain of office, sitting very upright, looking unimpressed',
  biscuit: 'head and shoulders portrait of a big friendly Saint Bernard mountain dog with a little wooden barrel on its collar, tongue out, snow on its nose',
  amos: person('a very old retired miner with a long white beard, a weathered tan canvas jacket and a yellow miner hard hat with a lamp on the front'),
};

/** What is sewn on each mineral's patch. */
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

/** What is sewn on each patch of the field guide. */
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

/**
 * Postcards for the passport's landmarks, by landmark id: a small scene each, in the same hand.
 * They describe a kind of place, not the place itself.
 */
const card = (what) => `a flat screen-printed landscape illustration of ${what}, in the manner of 1930s park service prints, a limited palette of five flat colours, bold simple shapes, strong silhouettes, the picture fills the whole frame edge to edge, there is no title, no caption and no lettering anywhere`;
export const PLACE_ART = {
  // What the town builds, once it is built.
  'lean-to': card('a three-sided log lean-to shelter in a hardwood forest, with a small stone fire ring in front of it'),
  'rabbit-dock': card('a small wooden dock reaching out over a still mountain pond ringed with fir trees'),
  bandstand: card('a little white bandstand with a green roof beside a duck pond in a small mountain town'),
  'burnt-ridge-hut': card('a small red warming hut with a smoking stove pipe at the top of a snowy ski hill, skis leaning against its wall'),
  'reservoir-deck': card('a wooden lookout deck with a railing on a hillside above a blue reservoir among forested hills'),
  'fire-tower': card('a steel fire lookout tower with a little red-roofed cabin on top, on a snowy forested mountain summit'),
  'saddle-lodge': card('a cosy timber ski lodge with a snow-covered roof and a smoking stone chimney, high on a mountain among fir trees'),
  'base-lodge': card('a big timber ski lodge at the foot of a snowy mountain, with skis leaning in a rack outside'),
  'ski-bowl-lodge': card('a small old-fashioned village ski hill with a wooden lodge and one chairlift, rooftops behind'),
  depot: card('a little old wooden railway depot with a platform canopy and a small black steam locomotive waiting, snow falling'),
  'vermont-overlook': card('a wooden lookout railing on a mountain ledge, with blue ridges fading into the far distance'),
  'twister-cliffs': card('grey rock cliffs beside a winding snowy ski trail through fir trees'),
  'windy-hill-lookout': card('a bare windy hilltop with one bent pine tree and a view over a river valley'),
  'scenic-view': card('a wooden bench at a roadside lookout facing forested mountains in autumn colours'),
  'barton-mine': card('an abandoned old garnet mine: rusted iron sheds and an ore cart on rails, dark red stones scattered on the ground'),
  'garnet-quarry': card('an open rock quarry with terraced grey walls studded with dark red garnet crystals'),
  'rabbit-pond': card('a small still pond in the woods with reeds, and a rabbit sitting at the water\'s edge'),
  'copperfield-inn': card('a long cream-coloured country inn with a green roof, dormer windows and a front porch, lamps lit, in snow'),
  'north-creek-post-office': card('a small brick village post office with a flag on a pole and a blue mailbox outside'),
  'town-of-johnsburg-library': card('a red brick town hall with white columns and a little cupola, a noticeboard outside and an orange cat on the steps'),
  'tannery-pond-community-association': card('a big red barn-like community hall beside a mill pond, with ducks'),
  'saint-james-catholic-church': card('a white wooden village church with a tall steeple, in snow'),
  'becks-tavern': card('a dark timber roadside tavern with a porch and warm lit windows at dusk'),
  'gore-mt-mineral-shop': card('a log cabin rock shop with a giant dark red garnet crystal on a stone plinth outside'),
  'old-gondola-mid-station': card('an abandoned concrete ski gondola station overgrown in a fir forest, with one old red gondola cabin left beside it'),
};

/**
 * The Book's look: everything in it is an embroidered patch, as a park's gift shop sells them
 * and a ranger's sash wears them. The owner chose this, with the trail map, as the look of the
 * whole Book. Only the portraits, which are not in the Book, keep the look above.
 */
export const ITEM_LOOK =
  'cute cosy collectible item icon, soft rounded chunky shapes, matte clay toy look, warm cheerful pastel colours, gentle soft shading, thick friendly proportions, centered on a plain cream background, nothing else in the picture, no text, no letters';

const patch = (what) => `a round embroidered cloth patch with a thick stitched border, showing ${what}`;
const pin = patch;
const food = patch;
const book = (what, colour) => patch(`a closed ${colour} storybook lying flat, its plain cover decorated only with a small picture of ${what}, the cover has no writing on it at all`);
const wear = patch;

/** Patches, for finishing a whole kind of thing: by patch id. */
export const PATCH_ART = {
  'first-tracks': patch('two ski tracks curving down a slope of fresh snow'),
  'green-circle': patch('one big green circle on white snow'),
  'blue-square': patch('one big blue square on white snow'),
  'black-diamond': patch('one black diamond shape on white snow'),
  'double-diamond': patch('two black diamond shapes side by side on white snow'),
  'in-the-trees': patch('three snowy fir trees close together'),
  'half-the-mountain': patch('a mountain whose lower half is striped with ski trails'),
  'every-trail': patch('a whole snowy mountain covered in winding ski trails'),
  pathfinder: patch('a compass and a dotted footpath through green woods'),
  chairman: patch('an empty chairlift chair hanging from a cable against blue sky'),
  'four-peaks': patch('four snowy mountain peaks in a row'),
  'sixteen-summits': patch('a mountain peak with a snowflake, a flower, a sun and a red maple leaf around it'),
  sightseer: patch('a pair of binoculars'),
  'four-seasons': patch('a circle in four quarters: a snowflake, a pink flower, a yellow sun and a red maple leaf'),
  weatherproof: patch('a cloud with a sun peeking out, rain drops and snowflakes'),
  rockhound: patch('a rock hammer and a white crystal'),
  'garnet-fever': patch('one big deep red garnet gemstone'),
  whopper: patch('an enormous deep red garnet crystal beside a tiny measuring ruler'),
  naturalist: patch('a magnifying glass over a green leaf with a ladybird on it'),
  'full-guide': patch('an open nature book with a small bird perched on it'),
  believer: patch('one very large hairy footprint in the snow'),
  'good-neighbour': patch('a little house with a red heart above it'),
  'pen-pal': patch('a cream envelope sealed with a red heart'),
  'bench-warmer': patch('a wooden park bench under a tree'),
  'around-town': patch('a row of three little shop fronts with striped awnings'),
  regular: patch('a steaming coffee cup beside a donut'),
  bookworm: patch('a stack of three books with a bookworm peeking out'),
  'good-dog': patch('the happy face of a Saint Bernard dog with its tongue out'),
};

/** Hats and jackets, by gear id. */
export const GEAR_ART = {
  'jacket-red': wear('a bright red puffy ski jacket'),
  'jacket-patrol': wear('a red ski patrol jacket with a big white cross on the chest'),
  'jacket-liftie': wear('a royal blue quilted work jacket'),
  'jacket-garnet': wear('a deep wine-red ski jacket'),
  'jacket-forest': wear('a forest green ranger jacket with chest pockets'),
  'jacket-groomer': wear('a bright orange high-visibility work jacket'),
  'jacket-postal': wear('a grey-blue mail carrier uniform jacket with brass buttons'),
  'jacket-innkeeper': wear('an elegant plum-coloured wool coat'),
  'jacket-instructor': wear('a bright green ski instructor jacket'),
  'hat-blue': wear('a teal blue knitted beanie with a pompom'),
  'hat-trapper': wear('a mustard yellow fur trapper hat with ear flaps'),
  'hat-toque': wear("a tall pleated chef's hat in pale grey-white with soft blue-grey shadows in its folds"),
  'hat-ranger': wear('a tan flat-brimmed ranger hat with a leather band'),
  'hat-garnet': wear('a deep wine-red knitted beanie'),
  'hat-cap': wear("a navy blue train conductor's peaked cap with a gold badge"),
  'hat-rainbow': wear('a bright yellow knitted hat with a huge pompom'),
  'hat-lamp': wear("a yellow miner's hard hat with a lamp on the front"),
  'hat-fenn': wear('a brown tweed brimmed hat'),
  'hat-tophat': wear('a black top hat with a cream band'),
  'hat-propeller': wear('a purple beanie cap with a little propeller on top'),
  'hat-helmet': wear('a red ski helmet with goggles on it'),
  'hat-antlers': wear('a headband with a pair of soft brown felt reindeer antlers'),
};

/** What the bakery, the deli and the library hand over, by offering id. */
export const OFFERING_ART = {
  'cider-doughnut': food('a cider donut dusted with sugar'),
  'garnet-thumbprint': food('a round thumbprint cookie with shiny red raspberry jam in the middle'),
  'first-tracks-scone': food('a triangular oat scone with a drizzle of maple icing'),
  'black-diamond-brownie': food('a thick square of dark chocolate brownie with a crackly top, on a small napkin'),
  'bear-claw': food('a bear claw pastry with sliced almonds on top'),
  'powder-popover': food('one tall golden-brown popover pastry, puffed up like a mushroom cloud, in a muffin tin cup'),
  'maple-cruller': food('a twisted cruller donut with shiny maple glaze'),
  'mud-season-muffin': food('a double chocolate muffin in a paper case'),
  'summit-sticky-bun': food('a very tall sticky cinnamon bun with pecans and caramel'),
  'blueberry-buckle': food('a square slice of blueberry cake with a crumb topping'),
  rumor: food('a sandwich wrapped up in brown paper and tied with string, with a tag bearing a question mark'),
  hullabaloo: food('an overstuffed sub sandwich on a long roll with everything in it'),
  twister: food('a sandwich on a pretzel roll with a spiral of yellow mustard on top'),
  potluck: food('a sandwich with a little red flag on a toothpick stuck in it'),
  lies: food('a big meaty sandwich with one small lettuce leaf laid on top of it'),
  'sleeping-bear': food('a peanut butter, honey and banana sandwich on white bread'),
  'open-pit': food('an open-faced barbecue pulled pork sandwich with a fork beside it'),
  'half-n-half': food('a sandwich cut in two halves, one half turkey and one half ham'),
  'wild-air': food('a sandwich overflowing with green lettuce'),
  'peaceful-valley': food('a grilled cheese sandwich beside a small cup of tomato soup'),
  quicksilver: food('smoked trout on dark rye bread, open-faced'),
  'book-garnet': book('a sheet of sandpaper and a red garnet', 'dark red'),
  'book-trains': book('a little steam train in the snow', 'navy blue'),
  'book-roosevelt': book('a horse-drawn wagon on a mountain road at night', 'dark green'),
  'book-gore': book('an old surveyor map with a wedge of land marked on it', 'tan'),
  'book-gondola': book('a little red gondola cabin on a cable', 'sky blue'),
  'book-tannery': book('a hemlock tree and a leather hide', 'brown'),
  'book-thurman': book('a tiny colonial village of log houses', 'mustard yellow'),
  'book-river': book('a canoe in white water rapids', 'teal'),
  'book-gem': book('a big red gemstone', 'cream'),
  'book-1964': book('a skier in old-fashioned clothes', 'orange'),
  'book-signs': book('a green circle, a blue square and a black diamond', 'white'),
  'book-tower': book('a fire lookout tower with a wisp of smoke on the horizon', 'forest green'),
};

/** Conditions stamps, by condition id. */
export const CONDITION_ART = {
  'first-light': pin('the sun rising behind a snowy mountain, pink sky'),
  bluebird: pin('a small bluebird flying in a clear blue sky with a bright sun'),
  alpenglow: pin('a snowy mountain peak glowing pink and orange at sunset'),
  'night-owl': pin('an owl on a branch in front of a crescent moon'),
  'powder-day': pin('big fluffy snowflakes falling from a snow cloud'),
  'corn-snow': pin('a smiling sun over a patch of melting sparkling snow'),
  'mud-season': pin('a muddy brown rubber boot in a puddle'),
  'dog-days': pin('a blazing yellow sun wearing sunglasses'),
  'firefly-night': pin('glowing yellow fireflies over dark grass at night'),
  soaker: pin('a grey rain cloud with rain drops and a red umbrella'),
  'peak-foliage': pin('red, orange and yellow autumn maple leaves'),
  'harvest-moon': pin('a huge orange full moon behind dark fir trees'),
  'first-coffee': pin('a steaming mug of coffee with a sunrise behind it'),
  sundowner: pin('a wooden bench silhouetted against an orange sunset'),
  stargazer: pin('a starry night sky with a shooting star over a mountain'),
};

/** Summit patches, by peak id, and lift pins, by the kind of lift. */
export const PEAK_ART = {
  gore: patch('a steel fire lookout tower on top of a snowy mountain'),
  bear: patch('a friendly black bear standing on a mountain top'),
  'burnt-ridge': patch('a long mountain ridge with one bare burnt tree on it'),
  'little-gore': patch('a small rounded snowy hill with a little flag on top'),
};
export const PIN_ART = {
  chair_lift: pin('a bright red ski chairlift chair hanging from a cable against a blue sky'),
  gondola: pin('a little red gondola cabin hanging from a cable'),
  magic_carpet: pin('a magic carpet conveyor belt going up a gentle snowy slope'),
  'j-bar': pin('a ski tow bar shaped like the letter J'),
};

/**
 * Pictures for the signs that hang over shop doors, by what the shop's board says. They are
 * drawn onto one sheet for the game to hang (`public/art/shop-signs.webp`).
 */
const hang = (what) => `${what}, one single object`;
export const SHOP_ART = {
  HARDWARE: hang('a hammer crossed with a wrench'),
  'BOOKS & MAPS': hang('an open book'),
  'GENERAL STORE': hang('a glass jar of striped candy sticks'),
  OUTFITTERS: hang('a brown leather hiking boot'),
  DINER: hang('a slice of cherry pie on a plate with a cup of coffee'),
  ANTIQUES: hang('an old wooden mantel clock'),
  BARBER: hang("a barber's pole with red, white and blue stripes"),
  'SKI & BIKE': hang('a pair of crossed wooden skis'),
  PHARMACY: hang('a mortar and pestle'),
  GALLERY: hang('a small painting of a mountain in a gold frame'),
  'YARN & THREAD': hang('a ball of red yarn with two knitting needles'),
  'ICE CREAM': hang('an ice cream cone with two scoops'),
  'TRADING POST': hang('a pair of wooden snowshoes'),
  FLORIST: hang('a bouquet of flowers in a pot'),
  CHOCOLATES: hang('an open box of chocolates'),
  RECORDS: hang('a black vinyl record'),
  'FIVE & DIME': hang('a red gumball machine'),
  'GUIDE SERVICE': hang('a brass compass'),
  TOYS: hang('a teddy bear'),
  LAUNDROMAT: hang('a washing machine full of bubbles'),
  CANOES: hang('a red canoe with a paddle'),
  PIZZA: hang('a slice of pepperoni pizza'),
  'SHOE REPAIR': hang("a cobbler's shoe and a small hammer"),
  POTTERY: hang('a blue glazed clay jug'),
  'MAPLE SYRUP': hang('a glass bottle of maple syrup shaped like a maple leaf'),
  'BAIT & TACKLE': hang('a trout leaping at a fishing fly'),
  'GARNET GIFTS': hang('a deep red cut gemstone'),
  'THRIFT SHOP': hang('a patched coat on a hanger'),
  'CLOCK REPAIR': hang('a gold pocket watch'),
  'FEED & SEED': hang('a burlap sack with a green sprout growing out of it'),
  NEWSSTAND: hang('a folded newspaper'),
  SUNDRIES: hang('a wicker basket of odds and ends'),
  // The places with names of their own.
  "JUNE'S BAKERY": hang('a crusty round loaf of bread'),
  "WALT'S DELI": hang('a tall sandwich with an olive on a toothpick'),
  'POST OFFICE': hang('a cream envelope with a red stamp'),
  MARKET: hang('a shopping basket of apples and bread'),
  'COPPERFIELD INN': hang('a big brass door key'),
  "BECK'S TAVERN": hang('a wooden mug of root beer with foam'),
  'SKI BOWL CAFE': hang('a steaming mug of hot chocolate with marshmallows'),
};

/**
 * The picture on the way in, one for each season: tall, for an upright phone. A place like this
 * one, not this one.
 */
/**
 * The pictures on the way in, one for each season, which are also the seasons' stamps in the
 * Book. They were soft storybook paintings once, and the first thing seen of a game that is a
 * flat print; now they are park posters like the postcards, in each season's own inks. All
 * four are asked for on one sheet (make-title.mjs), side by side, so that they are one place
 * seen four times and not four places.
 */
export const TITLE_MODEL = 'chat_image_2.5_sunburst';
export const TITLE_SEASONS = ['winter', 'spring', 'summer', 'fall'];
export const TITLE_BRIEF = `Four tall travel posters side by side in one image, in a single row. Each is exactly one quarter of the width and the full height, with a thin plain cream gutter between them.
All four are flat screen prints in the manner of 1930s park service posters: five or six flat inks each, bold simple shapes with hard clean edges, no gradients, no outlines, no paper texture, no lettering, no titles, no captions, no borders, no frames.
All four show the same little mountain village at the foot of a ski hill, from the same spot: a timber lodge with a stone chimney at the lower left, a chairlift whose towers and chairs climb the middle of a broad mountain, ski trails cut as pale ribbons through the forest, the summit in the upper third, a sky in two or three flat bands. They differ only in season and in ink.
First, far left, WINTER: cream snow, pale blue and slate blue shade, dark spruce green firs with snow on them, navy for the darkest shapes, smoke from the chimney, one small skier in a red jacket.
Second, SPRING: umber brown bare woods, the trails still ribbons of cream snow, khaki and olive meadows at the bottom, a few bud green trees, a pale blue sky.
Third, SUMMER: the trails meadow green, deep forest greens, cream dots of wildflowers in the foreground, a small blue pond, a bicycle hung from one chair of the lift, a warm cream sky.
Fourth, far right, FALL: the trails tan, the hardwoods in gold, orange, rust and maroon with dark pines among them, pumpkins by the lodge door, a golden cream sky.
Each poster is composed for its tall narrow shape, the picture reaching every edge of its panel.`;

/**
 * The Book's patches, as they are made now: in sheets of up to sixteen, by an image model that
 * keeps to a brief (tools/art/make-patches.mjs). One brief for every sheet, so that every patch
 * is the same patch with a different thing sewn on it; each kind of thing has its own colour of
 * border, as a trail map has a colour for each kind of trail.
 */
export const PATCH_BRIEF = (count, cols, rows, border, subjects) => `Sprite sheet of ${count} embroidered patches for a mobile game's collection book: a strict grid of ${cols} columns and ${rows} rows, even gaps, fully transparent background.
Every patch is identical in construction: a perfect circle of the same size, cream twill ground, a thick merrowed border in ${border}, the subject in flat satin stitch, bold simple shapes, thin navy outline. Straight on, flat, no shadow, no text or numbers.
Palette: cream #f7f1e3, navy #22304a, brick red #c8402d, pine #2f6b4f, blue #2b62c9, gold #c98f1f, tan #a9763f, white; brown, orange, grey or black only where needed.
Shown 100 pixels wide: each subject one clear centred shape that fills its patch.
Subjects, left to right, top row first:
${subjects.map((s, i) => `${i + 1} ${s}.`).join('\n')}`;

/** The first clause or two of a longer description: enough to sew. */
const brief = (text) => {
  const plain = text
    .replace(/^a round embroidered cloth patch with a thick stitched border, showing /, '')
    .replace(/^a single mineral specimen: /, '')
    .replace(/, whole body in view, side view$/, '')
    .replace(/, botanical study$/, '');
  // Short enough that sixteen of them fit in one brief: the model's limit is 1800 characters.
  const words = plain.split(', ')[0].split(' ');
  return words.slice(0, 10).join(' ');
};
/** Where the first clause alone would not say what the thing is. */
const SEWN = {
  'sixteen-summits': 'a snowy mountain peak under four small stars',
  'four-seasons': 'a circle in quarters: snowflake, pink flower, sun, red maple leaf',
  weatherproof: 'a cloud with the sun behind it and rain falling',
  'sleeping-bear': 'a peanut butter and banana sandwich on white bread',
};
const briefs = (art) => Object.fromEntries(Object.entries(art).map(([id, what]) => [id, SEWN[id] ?? brief(what)]));
const only = (art, keep) => Object.fromEntries(Object.entries(art).filter(([id]) => keep(id)));

/**
 * The pictures on the signs that hang over shop doors are made a sheet at a time too, to a
 * brief of their own: round painted signs, printed flat as a park poster is, so that they
 * belong to the world they hang in. (They were first painted one at a time as soft little
 * models, which did not.)
 */
export const SIGN_BRIEF = (count, cols, rows, border, subjects) => `Sprite sheet of ${count} round painted shop signs for a mobile game: a strict grid of ${cols} columns and ${rows} rows, even gaps, fully transparent background.
Every sign is identical in construction: a perfect circle of the same size, flat cream ground, a thick flat ring in ${border}, the subject printed flat in the style of a 1930s national park poster: bold simple shapes in three or four flat inks with a thick navy outline. Straight on. No shading, no gradients, no highlights, no texture, no shadow, no text or numbers
Palette: cream #f7f1e3, navy #22304a, brick red #c8402d, pine #2f6b4f, blue #2b62c9, gold #c98f1f, tan #a9763f, white; brown, orange, grey or black only where needed.
Shown 60 pixels wide: each subject one clear centred shape that fills its sign.
Subjects, left to right, top row first:
${subjects.map((s, i) => `${i + 1} ${s}.`).join('\n')}`;

/** Each set of patches: where its pictures go, the colour of its border, and what is sewn on each. */
/**
 * Things to wear, carry and bring along that are found on the mountain: what is sewn on each
 * one's patch. Made through fal, by the same family of model as the rest, to the same brief.
 */
const FOUND_ART = {
  'hat-beret': "a dark red painter's beret",
  'hat-crown': 'a yellow paper crown with uneven points',
  'hat-sugar': 'a red plaid wool cap with a short peak',
  'hat-straw': 'a wide straw sun hat',
  'jacket-1967': 'an orange knit ski sweater with a white stripe across the chest',
  'jacket-plaid': 'a red and black plaid wool jacket',
  'jacket-band': 'a navy marching band jacket with gold buttons',
  'jacket-moss': 'a moss green canvas camp jacket',
  'goggles-dark': 'ski goggles with dark grey lenses',
  'goggles-amber': 'ski goggles with amber orange lenses',
  'goggles-rose': 'ski goggles with rose pink lenses',
  'goggles-mirror': 'ski goggles with mirror blue lenses',
  'goggles-aviator': 'old round leather goggles with brown glass',
  'goggles-snow': 'ski goggles with white frames and pale blue lenses',
  'skis-gold': 'a pair of yellow skis, crossed',
  'skis-hickory': 'a pair of long brown wooden skis, crossed',
  'skis-racer': 'a pair of red skis with white tips, crossed',
  'skis-birch': 'a pair of white skis flecked with black like birch bark, crossed',
  'skis-garnet': 'a pair of dark red skis with gold tips, crossed',
  'skis-night': 'a pair of navy skis with small gold stars, crossed',
  'pack-leather': 'a brown leather backpack',
  'pack-basket': 'a woven wooden pack basket with leather straps',
  'pack-satchel': 'a grey canvas satchel with paintbrushes sticking out of it',
  'pack-red': 'a red daypack',
  'pack-roll': 'a green blanket rolled up and tied with two straps',
  'trail-plain': 'two ski tracks curving across white snow, drawn in pale blue',
  'trail-gold': 'two ski tracks curving across white snow, drawn in gold with sparkles',
  'trail-garnet': 'two ski tracks curving across white snow, drawn in dark red',
  'trail-sky': 'two ski tracks curving across white snow, drawn in bright blue',
  'trail-leaf': 'two ski tracks curving across white snow, drawn in leaf green',
  'tune-bells': 'a brass sleigh bell',
  'tune-fiddle': 'a fiddle and its bow',
  'tune-horn': 'a brass french horn',
  'tune-banjo': 'a banjo',
  'tune-squeezebox': 'a red accordion',
  'pet-kit': 'a fox kit sitting, orange with a white chest',
  'pet-duckling': 'a yellow duckling',
  'pet-chickadee': 'a black-capped chickadee',
  'pet-kitten': 'a small grey kitten sitting',
  'pet-toad': 'a brown toad',
};

/**
 * The insides of the rooms behind the mountain's locked doors, by the name each is filed
 * under (see `art` in src/game/secrets.ts): prints in the postcards' hand.
 */
export const ROOM_ART = {
  'mid-station': card('the inside of a small old ski lift station: a wooden bench along one wall, a pot-bellied stove, a round wall clock, and one small red gondola cabin standing indoors with its door open'),
  'mine-office': card('the inside of an old mine office: a wooden desk with an open ledger and an oil lamp, shelves of rock samples, a window with dusty light, a pair of leather goggles hanging from the lamp'),
  'tuning-shed': card('the inside of a wooden shed filled from floor to rafters with old wooden skis standing in rows, a workbench with a block of wax and an iron'),
  'power-house': card('the inside of an old brick power house: a big green dynamo with a flywheel, brass gauges on the wall, and a small grey kitten sitting on the floor in front of it'),
};

export const PATCH_SETS = {
  // Not for the Book: the shop signs' pictures, kept in the cache for make-art.mjs to lay out on their sheet.
  signs: { border: 'navy (#22304a)', subjects: Object.fromEntries(Object.entries(SHOP_ART).map(([name, what]) => [name, what.replace(', one single object', '')])), dir: 'tools/art/cache/shops/print', brief: SIGN_BRIEF },
  patches: { border: 'brick red (#c8402d)', subjects: briefs(PATCH_ART) },
  // Not one of the Book's: it comes with the last letter, for the cabin's board (KEEPSAKE in src/game/patches.ts).
  // A set of its own, so that the sheets already made for the others are cut as they were.
  keepsake: { border: 'gold (#c98f1f)', subjects: briefs({ 'whole-book': patch('an open book with a snowy mountain rising out of its pages and one gold star above the peak') }), into: 'patches' },
  peaks: { border: 'pine green (#2f6b4f)', subjects: briefs(PEAK_ART) },
  conditions: { border: 'gold (#c98f1f)', subjects: briefs(CONDITION_ART) },
  pins: { border: 'blue (#2b62c9)', subjects: briefs(PIN_ART) },
  gear: { border: 'navy (#22304a)', subjects: briefs(GEAR_ART) },
  // What is found on the mountain and in its secrets, in the same border as what is given for errands.
  'gear:found': { border: 'navy (#22304a)', into: 'gear', by: 'fal', subjects: FOUND_ART },
  // What is eaten and what is read are both in public/art/offerings, in different borders.
  offerings: { border: 'tan (#a9763f)', subjects: briefs(only(OFFERING_ART, (id) => !id.startsWith('book-'))) },
  'offerings:books': {
    border: 'plum purple (#7a4fa3)',
    into: 'offerings',
    subjects: {
      'book-garnet': 'a closed dark red book with a garnet on its cover',
      'book-trains': 'a closed navy book with a little steam train on its cover',
      'book-roosevelt': 'a closed dark green book with a horse-drawn wagon under a moon on its cover',
      'book-gore': 'a closed tan book with a folded map on its cover',
      'book-gondola': 'a closed sky blue book with a red gondola cabin on its cover',
      'book-tannery': 'a closed brown book with a hemlock tree on its cover',
      'book-thurman': 'a closed mustard yellow book with a log cabin on its cover',
      'book-river': 'a closed teal book with a canoe on its cover',
      'book-gem': 'a closed cream book with a big red gemstone on its cover',
      'book-1964': 'a closed orange book with a skier on its cover',
      'book-signs': 'a closed white book with a green circle, a blue square and a black diamond on its cover',
      'book-tower': 'a closed forest green book with a fire lookout tower on its cover',
    },
  },
  minerals: { border: 'slate grey-blue (#4d6168)', subjects: briefs(MINERAL_ART) },
  species: { border: 'leaf green (#4f8a3f)', subjects: briefs(SPECIES_ART) },
};

/**
 * The small marks printed on the ground (src/look/groundMarks.ts): fallen leaves, tufts of
 * grass, flower heads and the like. Each kind is asked for as a sheet of separate black
 * shapes on white; make-ground.mjs cuts the shapes out, and scatters them over a sheet that
 * repeats, one kind to a channel, for the game to print in the season's own inks. So the
 * shapes are painted, and the colours and the flatness are the print's.
 */
export const GROUND_LOOK =
  'Every one is a solid flat black silhouette with a clean simple outline, like a stencil cut for a screen print: no shading, no grey, no lines inside the shapes, no shadows. They are well separated, none touching, laid out in a neat grid of four rows and four columns on a plain pure white background. No text, no border, no frame.';
export const GROUND_ART = {
  leaves: 'A sheet of sixteen different fallen tree leaves seen flat from above: maple, oak, birch, beech and aspen leaves, each with a short stem',
  tufts: 'A sheet of sixteen small tufts of grass seen from directly above, each a little rosette of short pointed blades fanning out from its middle like a star',
  flowers: 'A sheet of sixteen small simple flower heads seen from directly above: daisies, buttercups and clover flowers, each just petals round a middle, with no stems',
  ferns: 'A sheet of sixteen small fern fronds and sprigs of clover seen flat from above',
  twigs: 'A sheet of sixteen small fallen twigs, sprigs of pine needles and little pine cones seen flat from above',
  pebbles: 'A sheet of sixteen small smooth pebbles, each a simple rounded lumpy shape, all different',
  strokes: 'A sheet of sixteen short thick horizontal brush strokes of ink, each a single straight dash with rough tapered ends, all lying level, all different lengths',
};
