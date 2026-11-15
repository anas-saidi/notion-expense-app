"use client";

import { flushSync } from "react-dom";

type ViewTransitionDocument = Document & { startViewTransition?: (update: () => void) => { ready: Promise<void>; finished: Promise<void> } };

/** Screen switches still fading (rapid taps overlap them). */
let running = 0;

/**
 * Switch primary screens (Home, Budget, Reflect) so the hero light crossfades
 * from one screen's light into the next instead of swapping in one frame.
 * The rest of the screen swaps instantly: tabs change tens of times a day, so
 * only the big coloured light, the change that jars, gets motion
 * (screen-hero.css, "Screen switch").
 *
 * Falls back to a plain swap when View Transitions are missing, or when the
 * hero is scrolled out of view (a light crossfading from off screen would slide).
 */
export function switchScreen(update: () => void) {
  const doc = document as ViewTransitionDocument;
  // Kept screens stay in the page while hidden; only the showing screen's hero has a box.
  const hero = [...document.querySelectorAll<HTMLElement>(".app-shell-root .screen-hero-mascot")].find(el => el.getClientRects().length > 0);
  const rect = hero?.getBoundingClientRect();
  const heroVisible = !!rect && rect.bottom > 0 && rect.top < window.innerHeight;
  if (!doc.startViewTransition || !heroVisible) { update(); return; }
  const root = document.documentElement;
  root.dataset.screenSwitch = "";
  running += 1;
  // Rapid taps overlap transitions: only the last one to finish clears the name.
  const done = () => { running -= 1; if (running === 0) delete root.dataset.screenSwitch; };
  try {
    const transition = doc.startViewTransition(() => flushSync(update));
    // A second tap mid-fade skips this one (the screen still updates); that rejection is expected.
    transition.ready.catch(() => {});
    transition.finished.catch(() => {}).finally(done);
  } catch {
    done();
    update();
  }
}
