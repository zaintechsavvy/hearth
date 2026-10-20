import { ImageResponse } from "next/og";
import { MARK } from "@/lib/brand";

const FILE = /^icon-(180|192|512)(-maskable)?\.png$/;

/** The Hearth mark as PNG app icons, white on a dark square, since a home screen fills a see-through icon anyway. Maskable icons keep the mark inside the safe zone and fill the square. */
export async function GET(_request: Request, { params }: RouteContext<"/icons/[file]">) {
  const match = FILE.exec((await params).file);
  if (!match) return new Response(null, { status: 404 });
  const size = Number(match[1]);
  const maskable = Boolean(match[2]) || size === 180;
  const mark = maskable ? size * 0.56 : size;
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: maskable ? MARK.ink : "transparent" }}>
        <svg width={mark} height={mark} viewBox="0 0 32 32">
          {!maskable && <rect width="32" height="32" rx="9" fill={MARK.ink} />}
          <path d={MARK.house} fill="none" stroke="#ffffff" strokeWidth="2.1" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  );
}
