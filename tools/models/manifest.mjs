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
 * The other way of making a shape: Tripo, from the words alone, asked for a low-poly model.
 * `turn` is what stands its models front on, as `turn` does below.
 */
export const TRIPO_SHAPE = {
  words: 'cute low poly game animal, chunky simple shapes, flat matte colours',
  ask: { model: 'v3.1-20260211', smart_low_poly: true, face_limit: 1500, texture: true, pbr: false, texture_quality: 'standard' },
  turn: 180,
};

/** The looks each model is converted into: see tools/models/convert.py, which can make others (faceted, smooth) to try. */
export const LOOKS = ['park'];

/**
 * Animals of the field guide, by species id. `turn` is degrees about upright to face it front,
 * if it came out facing some other way than most do; `tripoTurn` is the same for Tripo's shape.
 */
export const MODELS = {
  deer: { what: 'a white-tailed deer buck with antlers, standing' },
  fox: { what: 'a red fox standing, with black legs and a white-tipped bushy tail' },
  bear: { what: 'an American black bear standing on all fours', tripoTurn: 90 },
  moose: { what: 'a bull moose with wide antlers, standing', tripoTurn: 90 },
  otter: { what: 'a river otter standing on all fours, long body and thick tail' },
  beaver: { what: 'a beaver on all fours with a broad flat tail' },
  porcupine: { what: 'a North American porcupine on all fours, covered in quills' },
  squirrel: { what: 'a red squirrel sitting up with its bushy tail curled over its back' },
  raccoon: { what: 'a raccoon on all fours with a black mask and a ringed tail' },
  coyote: { what: 'an eastern coyote standing', turn: 90 },
  bobcat: { what: 'a bobcat standing, spotted tawny coat, tufted ears, short tail', turn: 90 },
  marten: { what: 'an American pine marten standing on all fours, dark brown with an orange throat' },
  turkey: { what: 'a wild turkey tom with its tail fanned out' },
  owl: { what: 'a barred owl perched upright, brown and white barred feathers, dark eyes', tripoTurn: 90 },
  eagle: { what: 'a bald eagle perched upright, white head and tail, dark brown body, yellow beak' },
  heron: { what: 'a great blue heron standing on long legs, neck curved', turn: 90 },
};
