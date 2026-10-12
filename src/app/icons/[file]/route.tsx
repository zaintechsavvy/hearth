import { ImageResponse } from "next/og";

const FILE = /^icon-(180|192|512)(-maskable)?\.png$/;

/** The Hearth mark as PNG app icons. Maskable icons keep the mark inside the safe zone and fill the square. */
export async function GET(_request: Request, { params }: RouteContext<"/icons/[file]">) {
  const match = FILE.exec((await params).file);
  if (!match) return new Response(null, { status: 404 });
  const size = Number(match[1]);
  const maskable = Boolean(match[2]) || size === 180;
  const mark = maskable ? size * 0.56 : size;
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: maskable ? "#111111" : "transparent" }}>
        <svg width={mark} height={mark} viewBox="0 0 32 32">
          {!maskable && <rect width="32" height="32" rx="9" fill="#111111" />}
          <path d="M10 23v-6.5a6 6 0 0 1 12 0V23" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="16" cy="18.2" r="1.9" fill="#ffffff" />
        </svg>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  );
}
