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
  { id: 'cider-doughnut', from: 'june', kind: 'bake', name: "Cider donut", hand: "Cider donut, still warm. The sugar gets everywhere.\nSorry. I'm not that sorry.", note: "Still warm. Found sugar in my pocket three days later." },
  { id: 'garnet-thumbprint', from: 'june', kind: 'bake', name: 'Garnet thumbprint', hand: "This one's a garnet thumbprint - raspberry jam.\nIt's the only garnet in town you can eat. I checked with Mica.", note: "Raspberry jam, the color of a garnet. Much softer." },
  { id: 'first-tracks-scone', from: 'june', kind: 'bake', name: 'First Tracks scone', hand: "First Tracks scone! Maple and oat.\nIt's best early, before the day really gets going.", note: "Maple and oat. Best before nine." },
  { id: 'black-diamond-brownie', from: 'june', kind: 'bake', name: 'Black Diamond brownie', hand: "Black Diamond brownie. It's really, really rich.\nMost people say they can't finish one. Most people do.", note: "Really rich. Finished it anyway." },
  { id: 'bear-claw', from: 'june', kind: 'bake', name: 'Bear claw', hand: "Bear claw. Almond.\nThere was an actual bear looking in the window last week, so. I guess word's out.", note: "Almond. Apparently the bears know about these." },
  { id: 'powder-popover', from: 'june', kind: 'bake', name: 'Powder Day popover', hand: "Powder Day popover. It's mostly air.\nThat's the good part, I promise.", note: "Light and hollow. Gone before the first chair." },
  { id: 'maple-cruller', from: 'june', kind: 'bake', name: 'Maple cream cruller', hand: "Maple cream cruller. The maple's from just up the road.\nThe cream's from a cow named Deborah. I've met her. She's great.", note: "Maple from up the road. Thank you, Deborah." },
  { id: 'mud-season-muffin', from: 'june', kind: 'bake', name: 'Mud Season muffin', hand: "Mud Season muffin. Double chocolate.\nIt's named after April, when the whole town's kind of this color.", note: "Double chocolate. Named after April." },
  { id: 'summit-sticky-bun', from: 'june', kind: 'bake', name: 'Summit sticky bun', hand: "Summit sticky bun. It's about as tall as it is wide.\nMaybe take the gondola after.", note: "Huge. Took a while. Worth it." },
  { id: 'blueberry-buckle', from: 'june', kind: 'bake', name: 'Blueberry buckle', hand: "Blueberry buckle! I picked the berries up on Burnt Ridge myself.\n...Okay, Gus picked most of them.", note: "Berries from Burnt Ridge. Gus helped." },
  // Walt's board. Every sandwich is named after a trail.
  { id: 'rumor', from: 'walt', kind: 'sandwich', name: 'The Rumor', trail: 'The Rumor', hand: "One Rumor. I don't tell anybody what's in it.\nPeople guess. Nobody's gotten it yet.", note: "Still don't know what was in it. Really good." },
  { id: 'hullabaloo', from: 'walt', kind: 'sandwich', name: 'The Hullabaloo', trail: 'Hullabaloo', hand: "The Hullabaloo. It's kind of everything in the kitchen, on a roll.\nIt's a lot. Good luck.", note: "Everything, on a roll. A lot." },
  { id: 'twister', from: 'walt', kind: 'sandwich', name: 'The Twister', trail: 'Twister', hand: "The Twister. It's on a pretzel roll, and the mustard goes on in a spiral.\nIt has to. I don't know why I'm like this.", note: "Pretzel roll. Mustard in a spiral. Walt insists." },
  { id: 'potluck', from: 'walt', kind: 'sandwich', name: 'The Potluck', trail: 'Potluck', hand: "The Potluck. It's different every day.\nI don't totally know what's in today's either.", note: "Different every day. Today's was good." },
  { id: 'lies', from: 'walt', kind: 'sandwich', name: 'The Lies', trail: 'Lies', hand: "The Lies. It says \"salad\" on the board.\nIt's not a salad.", note: "Listed as a salad. Not a salad." },
  { id: 'sleeping-bear', from: 'walt', kind: 'sandwich', name: 'The Sleeping Bear', trail: 'Sleeping Bear', hand: "The Sleeping Bear. Peanut butter, honey and banana.\nYou're going to want a nap after. Plan for that.", note: "Peanut butter, honey, banana. Then a nap." },
  { id: 'open-pit', from: 'walt', kind: 'sandwich', name: 'The Open Pit', trail: 'Open Pit', hand: "The Open Pit. Barbecue, open-faced.\nYou'll need a fork. Maybe two.", note: "Open-faced. Needed the fork." },
  { id: 'half-n-half', from: 'walt', kind: 'sandwich', name: "The Half 'N' Half", trail: "Half 'N' Half", hand: "The Half 'N' Half. Half turkey, half ham.\nIt's still a whole sandwich. People ask.", note: "Half turkey, half ham. Ate the whole thing." },
  { id: 'wild-air', from: 'walt', kind: 'sandwich', name: 'The Wild Air', trail: 'Wild Air', hand: "The Wild Air. It's mostly lettuce.\nIt's for people who just got off the gondola and need a minute.", note: "Mostly lettuce. Good after the gondola." },
  { id: 'peaceful-valley', from: 'walt', kind: 'sandwich', name: 'The Peaceful Valley', trail: 'Peaceful Valley', hand: "The Peaceful Valley. Grilled cheese and a cup of tomato soup.\nThat's it. It's my favorite one.", note: "Grilled cheese and tomato soup. Perfect." },
  { id: 'quicksilver', from: 'walt', kind: 'sandwich', name: 'The Quicksilver', trail: 'Quicksilver', hand: "The Quicksilver. Smoked trout on rye.\nPeople finish it before they sit down. I've watched.", note: "Smoked trout on rye. Gone fast." },
  // The library. Fenn lends one a day and never asks for it back.
  { id: 'book-garnet', from: 'fenn', kind: 'book', name: 'Sandpaper Empire', hand: "Try \"Sandpaper Empire.\" They've mined garnet on this mountain since 1878.\nNearly all of it went into sandpaper. I know. I know.", note: "Garnet has been mined at Gore since 1878. A mountain of gemstones, mostly sold as sandpaper." },
  { id: 'book-trains', from: 'fenn', kind: 'book', name: 'Ride Up, Slide Down', hand: "\"Ride Up, Slide Down.\" The first snow trains came up from Schenectady in March of 1934.\nTrucks took the skiers up the mine road, and they skied back down to town.", note: 'The snow trains reached North Creek in 1934. Skiers rode trucks up the mine road and skied back to town.' },
  { id: 'book-roosevelt', from: 'fenn', kind: 'book', name: 'The Night Ride', hand: "\"The Night Ride.\" In 1901 the Vice President came down out of the mountains by wagon, in the dark.\nHe found out at our depot that he was President. Imagine that ride.", note: 'In 1901 Theodore Roosevelt reached the North Creek depot after a night ride from the high peaks, and learned there that he was President.' },
  { id: 'book-gore', from: 'fenn', kind: 'book', name: 'A Gore in the Map', hand: "\"A Gore in the Map.\" A gore is a leftover wedge of land between two surveys.\nSo the mountain might be named after a mistake. I find that kind of comforting.", note: 'A gore is a leftover wedge between two surveys. The mountain, they say, is named for one.' },
  { id: 'book-gondola', from: 'fenn', kind: 'book', name: 'The Little Red Gondola', hand: "\"The Little Red Gondola.\" The first one opened in 1967. Four to a cabin, knees together.\nIts mid station is still out in the woods, if you know where to look.", note: 'The first gondola ran from 1967. Its old mid station still stands among the trees.' },
  { id: 'book-tannery', from: 'fenn', kind: 'book', name: 'Bark, Hides and Hemlock', hand: "\"Bark, Hides and Hemlock.\" This was a tannery town before it was a ski town.\nThe pond's named for it. I hear the smell was... memorable.", note: 'North Creek was a tannery town first. Tannery Pond remembers it.' },
  { id: 'book-thurman', from: 'fenn', kind: 'book', name: "Mr. Thurman's Town", hand: "\"Mr. Thurman's Town.\" Johnsburg is John's burg - John Thurman settled it in the 1790s.\nI don't think he spent very long on the name.", note: 'Johnsburg is named for John Thurman, who settled it in the 1790s.' },
  { id: 'book-river', from: 'fenn', kind: 'book', name: 'Derby Days', hand: "\"Derby Days.\" Every May since 1958, people have raced canoes down the Hudson right past town.\nIn snowmelt. On purpose!", note: 'The Hudson River White Water Derby has run past North Creek each May since 1958.' },
  { id: 'book-gem', from: 'fenn', kind: 'book', name: 'Ruby of the Adirondacks', hand: "\"Ruby of the Adirondacks.\" Garnet's been the state gem since 1969.\nSome of the crystals from the old mine were bigger than a dinner plate.", note: 'Garnet is the state gem of New York. The old mine on Gore held some of the largest crystals in the world.' },
  { id: 'book-1964', from: 'fenn', kind: 'book', name: 'State of the Slopes', hand: "\"State of the Slopes.\" The ski center opened in January of 1964, and it belongs to the State of New York.\nSo it's sort of your chairlift. A little bit.", note: 'Gore Mountain opened in 1964 and is owned by the State of New York.' },
  { id: 'book-signs', from: 'fenn', kind: 'book', name: 'How to Read a Trail Sign', hand: "\"How to Read a Trail Sign.\" Green circle, blue square, black diamond.\nIt's forty pages long. I'm honestly not sure what the other thirty-nine are for.", note: "Green circle, blue square, black diamond. Forty pages, somehow." },
  { id: 'book-tower', from: 'fenn', kind: 'book', name: 'Alone With the Smoke', hand: "\"Alone With the Smoke.\" Observers used to live on the summits all summer, watching for fires.\nOne of them reviewed every sunset in his logbook. Mostly good reviews.", note: 'Fire observers once spent whole summers on Adirondack summits, watching for smoke.' },
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
