/**
 * Small movements for the interface: a sheet that drops away when it is put down, and a patch
 * that is sewn on when it is earned. Everything else that moves is in the style sheet; these
 * are the two that need something made for them. Both are over in a moment and neither gets
 * in the way: a sheet is hidden the instant it is closed, and what is seen falling is only a
 * piece of paper its shape.
 */

/** True for someone who has asked their phone for less movement: then nothing here moves. */
const still = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A sheet is about to be put away: leave a piece of paper its size where it was, to drop out
 * of sight. Call just before hiding it; does nothing if it is hidden already.
 */
export function dropAway(sheet: HTMLElement): void {
  if (sheet.hidden || still()) return;
  const app = document.getElementById('app');
  const box = sheet.getBoundingClientRect();
  if (!app || box.height === 0) return;
  const from = app.getBoundingClientRect();
  const paper = document.createElement('div');
  paper.className = 'sheet-ghost';
  paper.style.left = `${box.left - from.left}px`;
  paper.style.top = `${box.top - from.top}px`;
  paper.style.width = `${box.width}px`;
  paper.style.height = `${box.height}px`;
  paper.style.borderRadius = getComputedStyle(sheet).borderRadius;
  paper.addEventListener('animationend', () => paper.remove());
  // (And if the animation never runs, it is not left lying about.)
  window.setTimeout(() => paper.remove(), 600);
  app.appendChild(paper);
}

/** What is filed under these is a patch, and is sewn on; a postcard or a painting is a picture, and is not. */
const SEWN_SETS = new Set(['patches', 'peaks', 'conditions', 'pins', 'gear', 'offerings', 'minerals', 'species']);

/** True if a picture, by where it is filed (`patches/first-tracks`), is a patch. */
export const isPatch = (art: string): boolean => SEWN_SETS.has(art.slice(0, art.indexOf('/')));

/**
 * True if what is being announced is a patch had for the first time: that is when one is sewn
 * on. Another garnet, or a chickadee seen again, is announced but is in the Book already.
 */
export function newPatch(event: { kind: string; detail: string; art?: string }): boolean {
  if (!event.art || !isPatch(event.art)) return false;
  if (event.kind === 'mineral') return event.detail.includes('New mineral');
  if (event.kind === 'sighting') return event.detail === 'New in the field guide';
  return true;
}

let made = 0;

/**
 * A patch being sewn on: the picture, with a ring of stitches put in round it one at a time
 * by a needle that goes round with them, and a press of the thumb at the end.
 * @returns the picture in its ring, to put where the picture would have gone
 */
export function sewn(picture: HTMLElement): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = 'sewn';
  // Each ring starts a hair off the last, so that two side by side are not sewn in step.
  wrap.style.setProperty('--turn', `${(made++ * 47) % 360}deg`);
  const NS = 'http://www.w3.org/2000/svg';
  const ring = document.createElementNS(NS, 'svg');
  ring.setAttribute('viewBox', '0 0 100 100');
  ring.setAttribute('aria-hidden', 'true');
  const thread = document.createElementNS(NS, 'circle');
  thread.setAttribute('class', 'thread');
  thread.setAttribute('cx', '50');
  thread.setAttribute('cy', '50');
  thread.setAttribute('r', '46');
  thread.setAttribute('pathLength', '120');
  ring.appendChild(thread);
  const needle = document.createElement('i');
  needle.className = 'needle';
  wrap.append(picture, ring, needle);
  return wrap;
}
