/**
 * Small things the town hands out, one a day from each place: something from June's oven,
 * a sandwich from Walt's board, a book from the library. Each is kept in the book the first
 * time, so the town is worth walking through every day. No DOM or three.js here.
 *
 * They ask for nothing and nothing is used up. There is no money on this mountain.
 */
export type OfferingKind = 'bake' | 'sandwich' | 'book';

export interface Offering {
  id: string;
  /** Who hands it over, by person id. */
  from: string;
  kind: OfferingKind;
  name: string;
  /** What they say as they hand it over. */
  hand: string;
  /** What the book keeps: a tasting note, or what the book was about. */
  note: string;
  /** For a sandwich: the trail on the mountain it is named after. Checked against the real map. */
  trail?: string;
}

export const OFFERINGS: readonly Offering[] = [
  // June's oven.
  { id: 'cider-doughnut', from: 'june', kind: 'bake', name: 'Cider doughnut', hand: 'Cider doughnut, still warm. The sugar gets everywhere. That is the point of it.', note: 'Warm. Sugar found in a pocket three days later.' },
  { id: 'garnet-thumbprint', from: 'june', kind: 'bake', name: 'Garnet thumbprint', hand: 'A garnet thumbprint. Raspberry jam. It is the only garnet in town you are allowed to eat.', note: 'Raspberry jam the colour of the state gem. Softer.' },
  { id: 'first-tracks-scone', from: 'june', kind: 'bake', name: 'First Tracks scone', hand: 'First Tracks scone: maple and oat. Eat it before anyone else has touched the day.', note: 'Maple and oat. Best eaten before nine.' },
  { id: 'black-diamond-brownie', from: 'june', kind: 'bake', name: 'Black Diamond brownie', hand: 'Black Diamond brownie. Most difficult. To share, I mean.', note: 'Experts only. Not shared.' },
  { id: 'bear-claw', from: 'june', kind: 'bake', name: 'Bear claw', hand: 'Bear claw. No bears were consulted, and one has complained.', note: 'Almond. A bear was seen looking at the window.' },
  { id: 'powder-popover', from: 'june', kind: 'bake', name: 'Powder Day popover', hand: 'Powder Day popover. Mostly air, like all the best snow.', note: 'Light, hollow, gone by the first chair.' },
  { id: 'maple-cruller', from: 'june', kind: 'bake', name: 'Maple cream cruller', hand: 'Maple cream cruller. The maple is from up the road. The cream is from a cow called Deborah.', note: 'Maple from up the road. Thank you, Deborah.' },
  { id: 'mud-season-muffin', from: 'june', kind: 'bake', name: 'Mud Season muffin', hand: 'Mud Season muffin. Double chocolate, named for the six weeks when the whole town is this colour.', note: 'Double chocolate. Named for April, fondly.' },
  { id: 'summit-sticky-bun', from: 'june', kind: 'bake', name: 'Summit sticky bun', hand: 'Summit sticky bun. It is as tall as it is wide. Take the gondola.', note: 'Three thousand six hundred calories. One for each foot.' },
  { id: 'blueberry-buckle', from: 'june', kind: 'bake', name: 'Blueberry buckle', hand: 'Blueberry buckle. I picked the berries on Burnt Ridge myself, or will say so if asked.', note: 'Berries from the ridge. Probably.' },
  // Walt's board. Every sandwich is named after a trail.
  { id: 'rumor', from: 'walt', kind: 'sandwich', name: 'The Rumor', trail: 'The Rumor', hand: 'One Rumor. Nobody will say what is in it. Everybody has heard.', note: 'Contents unconfirmed. Steep.' },
  { id: 'hullabaloo', from: 'walt', kind: 'sandwich', name: 'The Hullabaloo', trail: 'Hullabaloo', hand: 'The Hullabaloo: everything in the kitchen, loudly.', note: 'Everything, on a roll, with noise.' },
  { id: 'twister', from: 'walt', kind: 'sandwich', name: 'The Twister', trail: 'Twister', hand: 'The Twister. Pretzel roll. The mustard goes on in a spiral or it does not go on.', note: 'Pretzel roll. The mustard is a spiral. Walt insists.' },
  { id: 'potluck', from: 'walt', kind: 'sandwich', name: 'The Potluck', trail: 'Potluck', hand: 'The Potluck. Different every day. I do not know either.', note: 'Different every day. Today it was good.' },
  { id: 'lies', from: 'walt', kind: 'sandwich', name: 'The Lies', trail: 'Lies', hand: 'The Lies. It says salad on the board.', note: 'Listed as a salad. It is not a salad.' },
  { id: 'sleeping-bear', from: 'walt', kind: 'sandwich', name: 'The Sleeping Bear', trail: 'Sleeping Bear', hand: 'The Sleeping Bear: peanut butter, honey, banana. Do not operate a chairlift afterwards.', note: 'Peanut butter, honey, banana, and then a nap.' },
  { id: 'open-pit', from: 'walt', kind: 'sandwich', name: 'The Open Pit', trail: 'Open Pit', hand: 'The Open Pit. Barbecue, open faced. Structurally it is more of a quarry.', note: 'Open faced. A fork was issued.' },
  { id: 'half-n-half', from: 'walt', kind: 'sandwich', name: "The Half 'N' Half", trail: "Half 'N' Half", hand: "The Half 'N' Half. Half turkey, half ham. Whole sandwich. I checked.", note: 'Half turkey, half ham, entirely eaten.' },
  { id: 'wild-air', from: 'walt', kind: 'sandwich', name: 'The Wild Air', trail: 'Wild Air', hand: 'The Wild Air. Mostly lettuce. For people who have just come off the gondola looking green.', note: 'Mostly lettuce and good intentions.' },
  { id: 'peaceful-valley', from: 'walt', kind: 'sandwich', name: 'The Peaceful Valley', trail: 'Peaceful Valley', hand: 'The Peaceful Valley: grilled cheese and a cup of tomato soup. Nothing happens. It is wonderful.', note: 'Grilled cheese, tomato soup. Nothing happened. Wonderful.' },
  { id: 'quicksilver', from: 'walt', kind: 'sandwich', name: 'The Quicksilver', trail: 'Quicksilver', hand: 'The Quicksilver. Smoked trout on rye. People finish it before they sit down.', note: 'Smoked trout on rye. Gone at once.' },
  // The library. Fenn lends one a day and never asks for it back.
  { id: 'book-garnet', from: 'fenn', kind: 'book', name: 'Sandpaper Empire', hand: 'Try "Sandpaper Empire". They have dug garnet on this mountain since 1878, and nearly all of it went to make sandpaper.', note: 'Garnet has been mined at Gore since 1878. A mountain of gemstones, mostly sold as sandpaper.' },
  { id: 'book-trains', from: 'fenn', kind: 'book', name: 'Ride Up, Slide Down', hand: '"Ride Up, Slide Down". The first snow trains came up from Schenectady in March of 1934. Trucks took the skiers up the mine road and gravity brought them home.', note: 'The snow trains reached North Creek in 1934. Skiers rode trucks up the mine road and skied back to town.' },
  { id: 'book-roosevelt', from: 'fenn', kind: 'book', name: 'The Night Ride', hand: '"The Night Ride". In September of 1901 a Vice President came down out of the mountains by wagon in the dark, and learned at our depot that he was President. It is overdue, by the way. Not from you.', note: 'In 1901 Theodore Roosevelt reached the North Creek depot after a night ride from the high peaks, and learned there that he was President.' },
  { id: 'book-gore', from: 'fenn', kind: 'book', name: 'A Gore in the Map', hand: '"A Gore in the Map". A gore is a wedge of land the surveyors left over between two lines. So the story goes that the mountain is named after a mistake. I find that restful.', note: 'A gore is a leftover wedge between two surveys. The mountain, they say, is named for one.' },
  { id: 'book-gondola', from: 'fenn', kind: 'book', name: 'The Little Red Gondola', hand: '"The Little Red Gondola". The first one opened in 1967, four to a cabin, knees together. Its mid station is still standing in the woods, if you know where to look.', note: 'The first gondola ran from 1967. Its old mid station still stands among the trees.' },
  { id: 'book-tannery', from: 'fenn', kind: 'book', name: 'Bark, Hides and Hemlock', hand: '"Bark, Hides and Hemlock". This town tanned leather before it sold lift tickets. The pond is named for it. The smell, I am told, was also named.', note: 'North Creek was a tannery town first. Tannery Pond remembers it.' },
  { id: 'book-thurman', from: 'fenn', kind: 'book', name: "Mr Thurman's Town", hand: '"Mr Thurman\'s Town". Johnsburg is John\'s burg: John Thurman, who settled it in the 1790s and thought the name over for about a minute.', note: 'Johnsburg is named for John Thurman, who settled it in the 1790s.' },
  { id: 'book-river', from: 'fenn', kind: 'book', name: 'Derby Days', hand: '"Derby Days". Every May since 1958 people have raced canoes down the Hudson past this town, in snowmelt, on purpose.', note: 'The Hudson River White Water Derby has run past North Creek each May since 1958.' },
  { id: 'book-gem', from: 'fenn', kind: 'book', name: 'Ruby of the Adirondacks', hand: '"Ruby of the Adirondacks". Garnet has been the state gem since 1969. The crystals up at the old mine are some of the biggest anywhere. Bigger than a dinner plate, some of them.', note: 'Garnet is the state gem of New York. The old mine on Gore held some of the largest crystals in the world.' },
  { id: 'book-1964', from: 'fenn', kind: 'book', name: 'State of the Slopes', hand: '"State of the Slopes". The ski centre opened in January of 1964, and it belongs to the people of the State of New York. So in a way that is your chairlift. Mind it.', note: 'Gore Mountain opened in 1964 and is owned by the State of New York.' },
  { id: 'book-signs', from: 'fenn', kind: 'book', name: 'How to Read a Trail Sign', hand: '"How to Read a Trail Sign". Green circle, blue square, black diamond. It is forty pages. I do not know what the other thirty-nine are for.', note: 'Green circle, blue square, black diamond. Forty pages.' },
  { id: 'book-tower', from: 'fenn', kind: 'book', name: 'Alone With the Smoke', hand: '"Alone With the Smoke". Observers used to live on the summits all summer, watching for fires. One of them reviewed every sunset in his logbook. Mostly favourable.', note: 'Fire observers once spent whole summers on Adirondack summits, watching for smoke.' },
];

/** What each kind is called when it is handed over. */
export const OFFERING_KIND: Record<OfferingKind, string> = { bake: 'From the bakery', sandwich: 'From the deli', book: 'From the library' };

/** A small repeatable number from a string. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * What someone has for the player today, if anything: the next thing of theirs not yet in the
 * book, or, once the book has them all, one of them again for the pleasure of it.
 * @param had everything already in the book, by id, with the day each was first had
 * @returns the offering, and whether it is new to the book
 */
export function offeringFrom(personId: string, had: Record<string, string>, day: string): { offering: Offering; fresh: boolean } | null {
  const theirs = OFFERINGS.filter((o) => o.from === personId);
  if (theirs.length === 0) return null;
  // One new thing a day from each place.
  if (theirs.some((o) => had[o.id] === day)) return null;
  const next = theirs.find((o) => !(o.id in had));
  if (next) return { offering: next, fresh: true };
  return { offering: theirs[hash(day + personId) % theirs.length] as Offering, fresh: false };
}
