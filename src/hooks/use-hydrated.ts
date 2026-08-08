'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * True once the component has hydrated on the client.
 *
 * Used by controls whose correct output depends on browser-only state (the
 * stored theme, `navigator.share` support, the current origin). Implemented
 * with `useSyncExternalStore` rather than `useState` + `useEffect` so it does
 * not trigger a second render pass — React knows the server snapshot is
 * `false` and the client snapshot is `true`, and reconciles once.
 */
export function useHydrated() {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
