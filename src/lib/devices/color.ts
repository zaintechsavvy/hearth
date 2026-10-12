/** Hue in degrees, 0 to 360, and saturation, 0 to 100. */
export interface HueSaturation {
  hue: number;
  saturation: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function hsToRgb({ hue, saturation }: HueSaturation): [number, number, number] {
  const s = clamp(saturation, 0, 100) / 100;
  const h = ((hue % 360) + 360) % 360 / 60;
  const chroma = s;
  const x = chroma * (1 - Math.abs((h % 2) - 1));
  const [r, g, b] = h < 1 ? [chroma, x, 0] : h < 2 ? [x, chroma, 0] : h < 3 ? [0, chroma, x] : h < 4 ? [0, x, chroma] : h < 5 ? [x, 0, chroma] : [chroma, 0, x];
  const m = 1 - chroma;
  return [r + m, g + m, b + m].map(channel => Math.round(channel * 255)) as [number, number, number];
}

export function rgbToHs(red: number, green: number, blue: number): HueSaturation {
  const [r, g, b] = [red, green, blue].map(channel => clamp(channel, 0, 255) / 255);
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let hue = 0;
  if (delta > 0) hue = max === r ? 60 * (((g - b) / delta) % 6) : max === g ? 60 * ((b - r) / delta + 2) : 60 * ((r - g) / delta + 4);
  return { hue: Math.round((hue + 360) % 360), saturation: max === 0 ? 0 : Math.round(delta / max * 100) };
}

export const hsToHex = (color: HueSaturation) => `#${hsToRgb(color).map(channel => channel.toString(16).padStart(2, "0")).join("")}`;

export function hexToHs(hex: string): HueSaturation | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return rgbToHs(value >> 16, (value >> 8) & 255, value & 255);
}

/** CIE 1931 xy, as Zigbee and Matter bulbs that lack hue and saturation report colour, to and from hue and saturation. */
export function xyToHs(x: number, y: number): HueSaturation {
  if (y <= 0) return { hue: 0, saturation: 0 };
  const X = x / y, Z = (1 - x - y) / y;
  const linear = [3.2406 * X - 1.5372 - 0.4986 * Z, -0.9689 * X + 1.8758 + 0.0415 * Z, 0.0557 * X - 0.204 + 1.057 * Z];
  const max = Math.max(...linear, 1e-9);
  const [r, g, b] = linear.map(value => {
    const v = clamp(value / max, 0, 1);
    return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
  });
  return rgbToHs(r, g, b);
}

export function hsToXy(color: HueSaturation): { x: number; y: number } {
  const [r, g, b] = hsToRgb(color).map(channel => {
    const v = channel / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const X = r * 0.4124 + g * 0.3576 + b * 0.1805;
  const Y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const Z = r * 0.0193 + g * 0.1192 + b * 0.9505;
  const sum = X + Y + Z;
  return sum === 0 ? { x: 0.3127, y: 0.329 } : { x: X / sum, y: Y / sum };
}

export const kelvinToMired = (kelvin: number) => Math.round(1_000_000 / kelvin);
export const miredToKelvin = (mired: number) => Math.round(1_000_000 / mired);

/** An approximate on-screen colour for a white temperature, for tinting the tile. */
export function kelvinToHex(kelvin: number) {
  const t = clamp(kelvin, 1000, 40_000) / 100;
  const red = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const green = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492;
  const blue = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return `#${[red, green, blue].map(channel => Math.round(clamp(channel, 0, 255)).toString(16).padStart(2, "0")).join("")}`;
}
