/**
 * src/lib/session.ts
 *
 * Stores user profile (token stays in httpOnly cookie).
 */
import type { User } from "./api";

const KEY = "astrodeck.user.v1";

export function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function saveUser(user: User): void {
  localStorage.setItem(KEY, JSON.stringify(user));
}

export function clearUser(): void {
  localStorage.removeItem(KEY);
}
