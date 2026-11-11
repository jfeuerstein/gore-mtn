/**
 * Which lettering the interface is set in: the soft rounded face, or the poster capitals it had
 * first. The player's choice is kept in the browser, apart from the book, and is applied by
 * marking the page; the style sheet does the rest.
 */
export type Lettering = 'rounded' | 'poster';

const KEY = 'gore.type';

export function lettering(): Lettering {
  try {
    return localStorage.getItem(KEY) === 'poster' ? 'poster' : 'rounded';
  } catch {
    return 'rounded';
  }
}

export function setLettering(choice: Lettering): void {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    // Private browsing: it lasts until the page is closed.
  }
  document.documentElement.dataset.type = choice;
}
