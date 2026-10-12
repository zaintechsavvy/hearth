const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export function hexToHsl(hex: string): [number, number, number] {
  const value = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [value >> 16, (value >> 8) & 255, value & 255].map(channel => channel / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), light = (max + min) / 2, delta = max - min;
  if (delta === 0) return [0, 0, light];
  const saturation = delta / (1 - Math.abs(2 * light - 1));
  const hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return [(hue * 60 + 360) % 360, saturation, light];
}

export function hslToHex(hue: number, saturation: number, light: number) {
  const s = clamp(saturation), l = clamp(light), h = ((hue % 360) + 360) % 360;
  const chroma = (1 - Math.abs(2 * l - 1)) * s, x = chroma * (1 - Math.abs((h / 60) % 2 - 1)), m = l - chroma / 2;
  const [r, g, b] = h < 60 ? [chroma, x, 0] : h < 120 ? [x, chroma, 0] : h < 180 ? [0, chroma, x] : h < 240 ? [0, x, chroma] : h < 300 ? [x, 0, chroma] : [chroma, 0, x];
  return `#${[r, g, b].map(channel => Math.round((channel + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}

/** A soft, harmonious set of four: analogous, split, or triadic around a random hue, light enough to sit behind glass. */
export function shufflePalette(random: () => number = Math.random) {
  const base = random() * 360;
  const schemes = [[0, 28, -32, 180], [0, 150, 210, 30], [0, 120, 240, 60], [0, 18, 36, -20]];
  const offsets = schemes[Math.floor(random() * schemes.length)];
  return offsets.map((offset, index) => hslToHex(base + offset, 0.55 + random() * 0.3, index === 0 ? 0.9 : 0.74 + random() * 0.14));
}

/** The same colour for dark mode: much darker and a little calmer, so it reads as night rather than glare. */
export function darkenForNight(hex: string) {
  const [hue, saturation, light] = hexToHsl(hex);
  return hslToHex(hue, saturation * 0.85, 0.06 + light * 0.26);
}

/**
 * The main colours of a picture, by k-means over its pixels, most common first. Near-black and near-white pixels
 * count less, so a photo's subject sets the palette rather than its shadows or sky.
 */
export function paletteFromPixels(data: Uint8ClampedArray, count = 4) {
  const points: [number, number, number][] = [];
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < 128) continue;
    points.push([data[index], data[index + 1], data[index + 2]]);
  }
  if (points.length === 0) return [];
  let centres = Array.from({ length: count }, (_, index) => points[Math.floor((index + 0.5) * points.length / count)]);
  let sizes = new Array<number>(count).fill(0);
  for (let round = 0; round < 8; round++) {
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (const point of points) {
      let best = 0, bestDistance = Infinity;
      centres.forEach((centre, index) => {
        const distance = (centre[0] - point[0]) ** 2 + (centre[1] - point[1]) ** 2 + (centre[2] - point[2]) ** 2;
        if (distance < bestDistance) { bestDistance = distance; best = index; }
      });
      const brightness = (point[0] + point[1] + point[2]) / 765;
      const weight = brightness < 0.08 || brightness > 0.94 ? 0.25 : 1;
      sums[best][0] += point[0] * weight; sums[best][1] += point[1] * weight; sums[best][2] += point[2] * weight; sums[best][3] += weight;
    }
    centres = sums.map((sum, index) => sum[3] ? [sum[0] / sum[3], sum[1] / sum[3], sum[2] / sum[3]] : centres[index]);
    sizes = sums.map(sum => sum[3]);
  }
  return centres
    .map((centre, index) => ({ hex: `#${centre.map(channel => Math.round(channel).toString(16).padStart(2, "0")).join("")}`, size: sizes[index] }))
    .sort((a, b) => b.size - a.size)
    .map(entry => entry.hex)
    .filter((hex, index, all) => all.indexOf(hex) === index);
}
