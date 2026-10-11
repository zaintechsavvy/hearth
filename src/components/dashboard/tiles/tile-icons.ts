import {
  AirVent, Armchair, Baby, Bath, Bed, Bell, Blinds, Car, Cat, Coffee, CookingPot, DoorOpen, Dog, Droplets, Fan, Flame, Flower2,
  Gamepad2, Heater, House, Lamp, LampCeiling, LampDesk, LampFloor, Leaf, Lightbulb, Lock, Microwave, Monitor, Moon, Music, Plug,
  Power, Refrigerator, Router, ShowerHead, Snowflake, Sofa, Sparkles, Speaker, Star, Sun, Tv, WashingMachine, Wind, Zap,
  type LucideIcon,
} from "lucide-react";
import type { TileIcon } from "@/lib/dashboard/layout";

export const TILE_ICON_COMPONENTS: Record<TileIcon, LucideIcon> = {
  lightbulb: Lightbulb, lamp: Lamp, "lamp-desk": LampDesk, "lamp-floor": LampFloor, "lamp-ceiling": LampCeiling, sun: Sun, moon: Moon,
  sparkles: Sparkles, star: Star, fan: Fan, "air-vent": AirVent, wind: Wind, plug: Plug, power: Power, zap: Zap, tv: Tv, monitor: Monitor,
  speaker: Speaker, music: Music, gamepad: Gamepad2, coffee: Coffee, "cooking-pot": CookingPot, refrigerator: Refrigerator,
  microwave: Microwave, "washing-machine": WashingMachine, bed: Bed, sofa: Sofa, armchair: Armchair, bath: Bath, shower: ShowerHead,
  door: DoorOpen, lock: Lock, blinds: Blinds, heater: Heater, flame: Flame, snowflake: Snowflake, droplets: Droplets, leaf: Leaf,
  flower: Flower2, router: Router, car: Car, baby: Baby, dog: Dog, cat: Cat, bell: Bell, house: House,
};

export const TILE_ICON_LABELS: Partial<Record<TileIcon, string>> = { "lamp-desk": "Desk lamp", "lamp-floor": "Floor lamp", "lamp-ceiling": "Ceiling lamp", "air-vent": "Air vent", "cooking-pot": "Cooking pot", "washing-machine": "Washing machine" };

export const iconLabel = (icon: TileIcon) => TILE_ICON_LABELS[icon] ?? icon[0].toUpperCase() + icon.slice(1).replaceAll("-", " ");
