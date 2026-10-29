"use client";

import dynamic from "next/dynamic";

// The assistant orb and the keyboard-shortcuts sheet are not needed to read a page, so their code loads after it
// instead of with it (about 35 KB of source on every screen).
export const LazyNavAssistant = dynamic(() => import("@/components/NavAssistant").then((m) => m.NavAssistant), { ssr: false });
export const LazyShortcutsSheet = dynamic(() => import("@/components/ShortcutsSheet").then((m) => m.ShortcutsSheet), { ssr: false });
