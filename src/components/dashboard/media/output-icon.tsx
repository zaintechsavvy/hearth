import { Bluetooth, Headphones, Smartphone, Speaker, Tv } from "lucide-react";

export function OutputIcon({ name, size }: { name: string | null; size: number }) {
  const Icon = !name ? Speaker
    : /airpods|buds|headphone|headset|beats/i.test(name) ? Headphones
    : /bluetooth|soundlink|\bbt\b|jbl|boom|soundcore/i.test(name) ? Bluetooth
    : /\btv\b|television|chromecast|shield/i.test(name) ? Tv
    : /iphone|android|pixel|galaxy|phone/i.test(name) ? Smartphone
    : Speaker;
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" />;
}
