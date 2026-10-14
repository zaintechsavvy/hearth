/** How someone confirms opening the home: holding a button, or a PIN only the household knows. */
export type OpenMethod = "hold" | "pin";

export interface SecuritySettings {
  method: OpenMethod;
  /** scrypt of the PIN, never the PIN itself. */
  salt?: string;
  hash?: string;
}

export const DEFAULT_SECURITY: SecuritySettings = { method: "hold" };
export const PIN_PATTERN = /^\d{4,8}$/;
