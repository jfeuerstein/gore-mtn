import { describe, expect, it } from 'vitest';
import { SEASONS } from '../look/season';
import { LETTERS } from './letters';
import { MINERALS } from './minerals';
import { HALLS, keeperSays, PIECES, RELICS } from './museum';
import { OFFERINGS } from './offerings';
import { PATCHES } from './patches';
import { ERRANDS, GEAR, PEOPLE, personById } from './people';
import { PROJECTS } from './projects';
import { sayFresh, sky, snowReport, trailReason, wildlifeLog } from './report';
import { emptySave } from './save';
import { COME_BY, SECRETS } from './secrets';
import { slips } from './voice';
import { SPECIES, WATCHES } from './wildlife';

describe('the rule for how people talk', () => {
  it('catches what is said in full and what is spelled as it is abroad, and passes the rest', () => {
    expect(slips('I do not know. It is my favourite colour.')).toEqual(['do not', 'favourite', 'colour']);
    expect(slips("I don't know. It's my favorite color.")).toEqual([]);
    expect(slips('We do not have a plough.', true)).toEqual(['plough']);
    expect(slips('A gray jay on a grey day.')).toEqual(['grey']);
  });

  it('is kept by every table of words in the game', () => {
    const said: [string, string, boolean?][] = [];
    const add = (where: string, text: string | undefined, written = false): void => void (text && said.push([where, text, written]));
    for (const p of PEOPLE) {
      const written = p.kind === 'snowman';
      for (const line of [p.role, p.hello, ...p.chat, ...Object.values(p.seasonal ?? {}).flat(), ...Object.values(p.moods ?? {}).flat(), ...Object.values(p.wearing ?? {})]) add(`people/${p.id}`, line, written);
    }
    for (const e of ERRANDS) for (const line of [e.title, e.ask, e.nudge, e.thanks, e.thanksOwned, e.fetch?.handover, e.lost?.name, e.fetch?.name]) add(`errands/${e.id}`, line, personById(e.from)?.kind === 'snowman');
    for (const l of LETTERS) add(`letters/${l.id}`, `${l.text} ${l.signed}`, l.from === null || l.from === 'tom' || l.from === 'pip');
    for (const o of OFFERINGS) for (const line of [o.name, o.hand, o.note]) add(`offerings/${o.id}`, line);
    for (const m of MINERALS) for (const line of [m.name, m.about, m.hint]) add(`minerals/${m.id}`, line);
    for (const s of SPECIES) for (const line of [s.name, s.about, s.hint]) add(`species/${s.id}`, line);
    for (const p of PATCHES) for (const line of [p.name, p.how]) add(`patches/${p.id}`, line);
    for (const g of GEAR) add(`gear/${g.id}`, g.name);
    for (const [id, how] of Object.entries(COME_BY)) add(`come by/${id}`, how);
    for (const p of PROJECTS) for (const line of [p.name, p.ask, p.done, p.said]) add(`projects/${p.id}`, line);
    for (const s of SECRETS) for (const line of [s.name, s.action, ...s.pages.map((page) => page.text)]) add(`secrets/${s.id}`, line);
    for (const r of RELICS) for (const line of [r.name, r.label]) add(`relics/${r.id}`, line);
    for (const h of HALLS) for (const line of [h.name, h.bare]) add(`halls/${h.id}`, line);
    // What the museum's keeper says, however things stand.
    const empty = emptySave();
    const some = emptySave();
    some.minerals.garnet = { count: 1, best: 3, first: '2026-12-01' };
    const one = emptySave();
    one.museum['mineral:garnet'] = '2026-12-01';
    const full = emptySave();
    for (const piece of PIECES) full.museum[piece.key] = '2026-12-01';
    for (const r of RELICS) full.errands[r.id] = { taken: '2026-12-01', done: '2026-12-01' };
    for (const save of [empty, some, one, full]) for (const season of SEASONS) add('museum/keeper', keeperSays(save, '2026-12-01', season));
    // The boards, as they are chalked up in every season and watch.
    for (const season of SEASONS) {
      for (const watch of WATCHES) {
        for (const [overcast, falling] of [[0, 0], [1, 0], [1, 1]] as const) {
          const c = { season, overcast, falling, watch, day: '2026-12-01', fresh: 12 };
          add('report/sky', sky(c));
          add('report/sky', sky({ ...c, low: true }));
          add('report/snow', snowReport(c, 14, 100));
        }
        add('report/log', wildlifeLog(SPECIES, () => false, season, watch, '2026-12-01'));
      }
    }
    for (let d = 1; d <= 28; d++) for (const riding of [false, true]) add('report/reason', trailReason(`2026-12-${String(d).padStart(2, '0')}`, riding));
    for (const cm of [0, 2, 12, 40]) add('report/fresh', sayFresh(cm));
    expect(said.length).toBeGreaterThan(900);
    expect(said.flatMap(([where, text, written]) => slips(text, written).map((slip) => `${where}: "${slip}" in "${text.slice(0, 70)}"`))).toEqual([]);
  });
});
