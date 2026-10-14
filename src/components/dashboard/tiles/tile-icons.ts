import {
  AirVent, Armchair, Baby, Bath, Bed, Bell, Blinds, Car, Cat, Coffee, CookingPot, DoorOpen, Dog, Droplets, Fan, Flame, Flower2,
  Gamepad2, Heater, House, Lamp, LampCeiling, LampDesk, LampFloor, Leaf, Lightbulb, Lock, Microwave, Monitor, Moon, Music, Plug,
  Power, Refrigerator, Router, ShowerHead, Snowflake, Sofa, Sparkles, Speaker, Star, Sun, Tv, WashingMachine, Wind, Zap,
  Activity, BatteryMedium, BellRing, Camera, Clapperboard, DoorClosed, Gauge, LockOpen, Play, Shield, Thermometer, Warehouse, Calendar, ListChecks, Clock, Trash2, Recycle, Pill, Hourglass, StickyNote, Wifi, Timer, Sprout, Package, User, Users, CircleDot, ShoppingCart, Megaphone, Siren,
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
  "lock-open": LockOpen, "door-closed": DoorClosed, garage: Warehouse, activity: Activity, thermometer: Thermometer,
  battery: BatteryMedium, gauge: Gauge, clapperboard: Clapperboard, play: Play, shield: Shield, "bell-ring": BellRing, camera: Camera,
  calendar: Calendar, "list-checks": ListChecks, clock: Clock,
  trash: Trash2, recycle: Recycle, pill: Pill, hourglass: Hourglass, "sticky-note": StickyNote, wifi: Wifi, timer: Timer, sprout: Sprout, package: Package,
  user: User, users: Users, "circle-dot": CircleDot, "shopping-cart": ShoppingCart, megaphone: Megaphone, siren: Siren,
};

export const TILE_ICON_LABELS: Partial<Record<TileIcon, string>> = { "lock-open": "Unlocked", "door-closed": "Door", clapperboard: "Scene", "bell-ring": "Doorbell", activity: "Motion", "lamp-desk": "Desk lamp", "lamp-floor": "Floor lamp", "lamp-ceiling": "Ceiling lamp", "air-vent": "Air vent", "cooking-pot": "Cooking pot", "washing-machine": "Washing machine", "list-checks": "Checklist", "circle-dot": "Vacuum", "shopping-cart": "Shopping" };

export const iconLabel = (icon: TileIcon) => TILE_ICON_LABELS[icon] ?? icon[0].toUpperCase() + icon.slice(1).replaceAll("-", " ");
