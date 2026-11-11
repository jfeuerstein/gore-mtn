import { describe, expect, it } from 'vitest';
import { dayKey, emptySave, parseSave, saveFromCode, saveToCode, serializeSave, type SaveData } from './save';

const sample = (): SaveData => ({
  ...emptySave(),
  trails: { Sunway: { seen: '110111', stamped: '2026-11-10' }, Twister: { seen: '0100' } },
  lifts: { 'Adirondack Express': '2026-11-10' },
  peaks: { gore: '2026-11-11' },
  landmarks: { 'fire-tower': '2026-11-11' },
  conditions: { 'powder-day': '2026-11-12' },
  minerals: { garnet: { count: 3, best: 4.2, first: '2026-11-10' } },
  found: { day: '2026-11-12', spots: ['3:4:1', '3:4:7'] },
});

describe('save', () => {
  it('survives being written and read back', () => {
    expect(parseSave(serializeSave(sample()))).toEqual(sample());
  });

  it('starts empty when there is nothing stored, or nonsense', () => {
    expect(parseSave(null)).toEqual(emptySave());
    expect(parseSave('')).toEqual(emptySave());
    expect(parseSave('not json')).toEqual(emptySave());
    expect(parseSave('[1,2,3]')).toEqual(emptySave());
    expect(parseSave('"hello"')).toEqual(emptySave());
  });

  it('keeps what is sound in a damaged save and drops the rest', () => {
    const damaged = {
      trails: { Sunway: { seen: '1101', stamped: '2026-11-10' }, Bad: { seen: 'xx1' }, Worse: 7, Undated: { seen: '11', stamped: 'yesterday' } },
      lifts: { Good: '2026-11-10', Bad: 'last week', Worse: 5 },
      minerals: { garnet: { count: 2, best: 3, first: '2026-11-10' }, fake: { count: 'lots', best: 9, first: '2026-11-10' }, none: { count: 0, best: 1, first: '2026-11-10' } },
      found: { day: 'today', spots: ['a'] },
      peaks: 'everest',
    };
    const save = parseSave(JSON.stringify(damaged));
    expect(save.trails).toEqual({ Sunway: { seen: '1101', stamped: '2026-11-10' }, Undated: { seen: '11' } });
    expect(save.lifts).toEqual({ Good: '2026-11-10' });
    expect(save.minerals).toEqual({ garnet: { count: 2, best: 3, first: '2026-11-10' } });
    expect(save.found).toEqual({ day: '', spots: [] });
    expect(save.peaks).toEqual({});
  });

  it('round-trips through a copyable code, accents and all', () => {
    const save = sample();
    save.landmarks['café-sarah'] = '2026-11-13';
    const code = saveToCode(save);
    expect(code.startsWith('GORE1.')).toBe(true);
    expect(saveFromCode(`  ${code}\n`)).toEqual(save);
  });

  it('refuses a code that is not one of ours', () => {
    expect(saveFromCode('hello')).toBeNull();
    expect(saveFromCode('GORE1.!!!')).toBeNull();
    expect(saveFromCode('GORE1.bm90IGpzb24=')).toBeNull(); // "not json"
  });
});

describe('the cabin', () => {
  it('is kept with the book, and a book from before there was one has it bare', () => {
    expect(parseSave('{}').cabin).toEqual({ shelf: ['', '', '', '', ''], wall: ['', '', ''], feeder: '' });
    const save = emptySave();
    save.cabin = { shelf: ['garnet', '', 'quartz', '', ''], wall: ['first-tracks', '', ''], feeder: '2026-11-10' };
    expect(parseSave(serializeSave(save)).cabin).toEqual(save.cabin);
  });

  it('mends a damaged one', () => {
    expect(parseSave('{"cabin":{"shelf":["garnet",7],"wall":"no","feeder":"soon"}}').cabin).toEqual({ shelf: ['garnet', '', '', '', ''], wall: ['', '', ''], feeder: '' });
  });
});

describe('the flag', () => {
  it('is kept with the book, and a book from before there were flags has none', () => {
    expect(parseSave('{}').flag).toBeNull();
    const save = emptySave();
    save.flag = { x: 12.5, z: -40, label: 'Top of Sunway' };
    expect(parseSave(serializeSave(save)).flag).toEqual({ x: 12.5, z: -40, label: 'Top of Sunway' });
  });

  it('drops a flag that is not somewhere', () => {
    expect(parseSave('{"flag":{"x":"here","z":2}}').flag).toBeNull();
    expect(parseSave('{"flag":{"x":1,"z":2}}').flag).toEqual({ x: 1, z: 2, label: 'Your flag' });
  });
});

describe('dayKey', () => {
  it('formats the local date', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(dayKey(new Date(2026, 10, 12, 0, 1))).toBe('2026-11-12');
  });
});
