"use client";

import { createContext, useContext } from "react";
import { TRADES } from "@/lib/trades";

const Names = createContext<readonly string[]>(TRADES);

/** Gives the screens the company's trade list, so every trade dropdown offers the trades added on the Trades page too. */
export function TradesProvider({ names, children }: { names: readonly string[]; children: React.ReactNode }) {
  return <Names.Provider value={names}>{children}</Names.Provider>;
}

/** The trades to offer in a dropdown. Outside a provider it is the built-in list. */
export function useTradeNames(): readonly string[] {
  return useContext(Names);
}
