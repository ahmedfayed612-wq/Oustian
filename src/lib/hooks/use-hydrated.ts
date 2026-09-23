"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * `true` once the app is running in the browser, `false` during SSR and the
 * hydration pass. Use it for values that genuinely cannot be known on the
 * server (the resolved color theme, the local clock, viewport size) so the
 * server HTML and the first client render still match.
 */
export function useHydrated() {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
