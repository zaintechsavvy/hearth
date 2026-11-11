/**
 * The dashboard's rooms, shared with the wall tablet's menu so the menu can switch rooms. The dashboard publishes
 * what it shows; the menu asks for a room, which the dashboard takes up as soon as it is on screen.
 */
export interface WallRooms {
  rooms: string[];
  current: string | null;
  wanted: string | null;
}

let state: WallRooms = { rooms: [], current: null, wanted: null };
const listeners = new Set<() => void>();
const emit = () => { for (const listener of listeners) listener(); };

export const wallRooms = () => state;
export function subscribeWallRooms(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function publishWallRooms(rooms: string[], current: string) {
  if (state.current === current && state.rooms.join("\n") === rooms.join("\n")) return;
  state = { ...state, rooms, current };
  emit();
}

/** `null` asks for every room. */
export function wantWallRoom(room: string | null) {
  state = { ...state, wanted: room ?? "" };
  emit();
}

export function takeWantedRoom() {
  const wanted = state.wanted;
  if (wanted !== null) state = { ...state, wanted: null };
  return wanted;
}
