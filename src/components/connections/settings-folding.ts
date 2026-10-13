"use client";

import { createContext } from "react";

export interface SettingsFolding {
  /** The section showing its contents, or null when all are folded. */
  open: string | null;
  select: (id: string | null) => void;
}

export const SettingsFoldingContext = createContext<SettingsFolding>({ open: null, select: () => {} });
