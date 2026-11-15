"use client";

import { useEffect, useState } from "react";

/**
 * False on the server and during hydration, true once mounted in the browser. Components that
 * render form controls over the 3D tour (the chat, the logger) wait for it, so their HTML is
 * never server-rendered: browser autofill (Edge's, password managers) stamps attributes such as
 * fdprocessedid onto server-rendered buttons and inputs before React hydrates, which React then
 * reports as a hydration mismatch. The tour itself is browser-only anyway.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
