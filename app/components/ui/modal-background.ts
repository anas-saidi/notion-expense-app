const locks = new WeakMap<HTMLElement, { count: number; wasInert: boolean }>();

/** Restore the original state only after the last modal releases the app surface. */
export function lockModalBackground(element: HTMLElement): () => void {
  const lock = locks.get(element) ?? { count: 0, wasInert: element.inert };
  lock.count += 1;
  locks.set(element, lock);
  element.inert = true;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lock.count -= 1;
    if (lock.count === 0) {
      element.inert = lock.wasInert;
      locks.delete(element);
    }
  };
}
