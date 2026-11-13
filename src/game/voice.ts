/**
 * How people here talk, as one rule to hold every table of words to: in contractions, the way
 * a person says it to a friend, and spelled as it is in upstate New York. The tests of each
 * table ask `slips` what breaks it. No DOM or three.js here.
 */

/** Said in full where anybody speaking would run it together. */
const STIFF = /\b(do not|does not|did not|is not|are not|was not|were not|cannot|will not|would not|could not|should not|have not|has not|I am not)\b/gi;
/** Spelled as it is across the water. */
const ABROAD = /\b(colou?red|colours?|favourites?|neighbours?|centre|ploughs?|ploughed|practise|metres?|doughnuts?|labelled|car parks?|cosy|grey|travell(?:ed|ing|er)|jewell(?:er|ery)|theatre|kerb|tyres?|storey)\b/gi;

/**
 * What in a piece of the game's wording breaks the rule, word by word; nothing if it keeps it.
 * @param written true for something that is written out and not said (Tom's notes are in a
 *   nine-year-old's hand, and she writes it all out): the contractions are not asked of it
 */
export function slips(text: string, written = false): string[] {
  return [...(written ? [] : (text.match(STIFF) ?? [])), ...(text.match(ABROAD) ?? [])];
}
