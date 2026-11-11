/** The ground each modelled building stands on, as width and depth in metres, for walking round them. No three.js here. */
export const PLACE_FOOTPRINT: Record<string, [number, number]> = {
  'base-lodge': [44, 16],
  'saddle-lodge': [22, 11],
  'gore-mountain-lodge': [30, 13],
  'ski-bowl-lodge': [24, 11],
  'warming-hut': [7, 5.5],
  'warming-hut-2': [7, 5.5],
  depot: [26, 8],
  summit: [4.4, 4.4],
};

/** How high each stands above its footing, roof and all, in metres: for keeping the camera above it. */
export const PLACE_HEIGHT: Record<string, number> = {
  'base-lodge': 19,
  'saddle-lodge': 11,
  'gore-mountain-lodge': 14,
  'ski-bowl-lodge': 13,
  'warming-hut': 7.5,
  'warming-hut-2': 7.5,
  depot: 9,
  summit: 22,
};
