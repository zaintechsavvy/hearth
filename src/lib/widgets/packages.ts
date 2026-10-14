import type { CARRIERS, ItemData } from "./items";
import { daysBetween, localDay } from "./schedules";

export type Carrier = (typeof CARRIERS)[number];
type Package = ItemData<"package">;

export const CARRIER_NAMES: Record<Carrier, string> = {
  amazon: "Amazon", "canada-post": "Canada Post", purolator: "Purolator", ups: "UPS", fedex: "FedEx", usps: "USPS", dhl: "DHL", other: "Other",
};

/**
 * The carrier a tracking number most likely belongs to, from its shape, checked most specific first. Twelve-digit
 * numbers are shared by Purolator and FedEx, so they go to neither and the person picks.
 */
export function detectCarrier(tracking: string): Carrier | null {
  const number = tracking.replace(/\s+/g, "").toUpperCase();
  if (!number) return null;
  if (/^TB[ACM]\d{12}$/.test(number)) return "amazon";
  if (/^1Z[0-9A-Z]{16}$/.test(number)) return "ups";
  if (/^[A-Z]{2}\d{9}CA$/.test(number) || /^\d{16}$/.test(number)) return "canada-post";
  if (/^[A-Z]{2}\d{9}US$/.test(number) || /^9[2-5]\d{20}$/.test(number)) return "usps";
  if (/^(\d{15}|\d{20})$/.test(number)) return "fedex";
  if (/^\d{10}$/.test(number)) return "dhl";
  return null;
}

/** The carrier's public tracking page, or a universal tracker when the carrier is not known. */
export function trackingUrl(carrier: Carrier, tracking: string) {
  const number = encodeURIComponent(tracking.replace(/\s+/g, ""));
  if (!number) return null;
  switch (carrier) {
    case "amazon": return `https://track.amazon.com/tracking/${number}`;
    case "canada-post": return `https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor=${number}`;
    case "purolator": return `https://www.purolator.com/en/shipping/tracker?pin=${number}`;
    case "ups": return `https://www.ups.com/track?tracknum=${number}`;
    case "fedex": return `https://www.fedex.com/fedextrack/?trknbr=${number}`;
    case "usps": return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${number}`;
    case "dhl": return `https://www.dhl.com/global-en/home/tracking/tracking-express.html?tracking-id=${number}`;
    case "other": return `https://t.17track.net/en#nums=${number}`;
  }
}

export type PackageMood = "collect" | "today" | "late" | "soon" | "coming" | "collected";

/** What the tile says about a package, and how loudly. */
export function packageStatus(item: Package, now: Date): { mood: PackageMood; words: string } {
  if (item.status === "collected") return { mood: "collected", words: "Collected" };
  if (item.status === "delivered") return { mood: "collect", words: item.deliveredAt && localDay(new Date(item.deliveredAt)) !== localDay(now) ? "Delivered, waiting to be collected" : "Delivered, collect it" };
  if (!item.expected) return { mood: "coming", words: "On the way" };
  const days = daysBetween(now, new Date(`${item.expected}T12:00:00`));
  if (days < 0) return { mood: "late", words: `Running late, due ${dayWords(item.expected, now)}` };
  if (days === 0) return { mood: "today", words: "Arriving today" };
  if (days === 1) return { mood: "soon", words: "Arriving tomorrow" };
  return { mood: "coming", words: `Arriving ${dayWords(item.expected, now)}` };
}

function dayWords(day: string, now: Date) {
  const date = new Date(`${day}T12:00:00`);
  const days = daysBetween(now, date);
  return days > 1 && days < 7 ? date.toLocaleDateString(undefined, { weekday: "long" }) : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const ORDER: Record<PackageMood, number> = { collect: 0, today: 1, late: 2, soon: 3, coming: 4, collected: 5 };

/** Waiting to be collected first, then by when each is due. Collected packages stay for a day, then leave the tile. */
export function shownPackages<T extends { data: Package }>(items: T[], now: Date) {
  return items
    .filter(item => item.data.status !== "collected" || (item.data.collectedAt && now.getTime() - Date.parse(item.data.collectedAt) < 86_400_000))
    .map(item => ({ item, status: packageStatus(item.data, now) }))
    .sort((a, b) => ORDER[a.status.mood] - ORDER[b.status.mood] || (a.item.data.expected ?? "9999").localeCompare(b.item.data.expected ?? "9999"));
}

export const normalTracking = (tracking: string) => tracking.replace(/\s+/g, "").toUpperCase();

/** Whether a tracker's status means the package is here: delivered, or waiting at a pickup point. */
export const trackerSaysArrived = (status: string) => /^delivered$|ready.*pick|picked up|available for pickup/i.test(status.trim()) && !/undelivered/i.test(status);

/** Packages a tracker can follow: still coming, with a number, and not Amazon's own, which only Amazon tracks. */
export const followable = (item: Package) => item.status === "coming" && Boolean(item.tracking.trim()) && item.carrier !== "amazon";

/** Where a package comes from in a few words: "Amazon", or "Best Buy via Purolator". */
export function packageSource(item: Pick<Package, "from" | "carrier">) {
  const carrier = item.carrier === "other" ? "" : CARRIER_NAMES[item.carrier];
  if (!item.from) return carrier;
  return carrier && carrier.toLowerCase() !== item.from.trim().toLowerCase() ? `${item.from} via ${carrier}` : item.from;
}
