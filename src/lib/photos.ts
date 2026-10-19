import "server-only";
import { IntegrationError } from "@/lib/integrations/types";

export interface FramePhoto {
  id: string;
  width: number;
  height: number;
}

export interface ImmichAlbum {
  url: string;
  key: string;
  album: string;
}

const TIMEOUT_MS = 10_000;
const ALBUM_ID = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

/** The album's id from what was pasted: the id itself, or the album's address in Immich. */
export const albumId = (text: string) => ALBUM_ID.exec(text)?.[1]?.toLowerCase() ?? null;

async function immich(album: ImmichAlbum, path: string, signal?: AbortSignal) {
  let response: Response;
  try {
    response = await fetch(new URL(path, album.url.endsWith("/") ? album.url : `${album.url}/`), { headers: { "x-api-key": album.key }, cache: "no-store", signal: signal ?? AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new IntegrationError(`Could not reach Immich at ${album.url}.`);
  }
  if (response.status === 401 || response.status === 403) throw new IntegrationError("Immich rejected the API key. It needs the album.read and asset.view permissions.");
  if (response.status === 404 || response.status === 400) throw new IntegrationError("Immich has no album with that id.");
  if (!response.ok) throw new IntegrationError(`Immich returned ${response.status}.`);
  return response;
}

interface ImmichAsset {
  id: string;
  type: string;
  isTrashed?: boolean;
  exifInfo?: { exifImageWidth?: number | null; exifImageHeight?: number | null; orientation?: string | null } | null;
}

/** The album's photos, without its videos, and its name. */
export async function albumPhotos(album: ImmichAlbum): Promise<{ name: string; photos: FramePhoto[] }> {
  const body = await (await immich(album, `api/albums/${album.album}`)).json() as { albumName?: string; assets?: ImmichAsset[] };
  const photos = (body.assets ?? []).filter(asset => asset.type === "IMAGE" && !asset.isTrashed).map(asset => {
    const turned = ["6", "8", "Rotate 90 CW", "Rotate 270 CW"].includes(asset.exifInfo?.orientation ?? "");
    const width = asset.exifInfo?.exifImageWidth || 1600, height = asset.exifInfo?.exifImageHeight || 1200;
    return { id: asset.id, width: turned ? height : width, height: turned ? width : height };
  });
  return { name: body.albumName ?? "Album", photos };
}

/** One photo at screen size, which Immich keeps ready as its preview. */
export async function albumPhoto(album: ImmichAlbum, id: string, signal: AbortSignal) {
  return immich(album, `api/assets/${encodeURIComponent(id)}/thumbnail?size=preview`, signal);
}
