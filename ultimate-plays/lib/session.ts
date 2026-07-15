import type { SessionOptions } from "iron-session";

export interface SessionData {
  email: string;
  role: "member" | "editor" | "admin";
}

export const sessionOptions: SessionOptions = {
  cookieName: "ultimate-plays-session",
  password: process.env.SESSION_SECRET as string,
  ttl: 60 * 60 * 24 * 7, // 1 week
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  },
};
