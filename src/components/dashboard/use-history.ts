"use client";

import useSWR from "swr";
import type { History, HistoryRange } from "@/lib/history";

const fetchHistory = async (url: string): Promise<History> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("History is unavailable.");
  return response.json();
};

export function useHistory(deviceId: string | null, range: HistoryRange = "24h") {
  return useSWR<History>(deviceId ? `/api/devices/${encodeURIComponent(deviceId)}/history?range=${range}` : null, fetchHistory, { refreshInterval: 5 * 60_000, keepPreviousData: true });
}
