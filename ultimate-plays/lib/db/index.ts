import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// DATABASE_URL may be absent during `next build` on Vercel (build-time env vars
// are not injected unless explicitly added). We guard here so the module can be
// imported at build time without throwing.  Any actual runtime query will still
// fail fast if the env var is missing — which is the correct behaviour.
const connectionString = process.env.DATABASE_URL;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: ReturnType<typeof drizzle<typeof schema>>;

if (connectionString) {
  // Disable prefetch for serverless environments (Vercel)
  const client = postgres(connectionString, { prepare: false });
  db = drizzle(client, { schema });
} else {
  // Dummy client — will throw if any query is actually executed without the env
  // var set, but avoids a crash during `next build`.
  const client = postgres("postgresql://placeholder:placeholder@localhost/placeholder", {
    prepare: false,
    max: 0,
  });
  db = drizzle(client, { schema });
}

export { db };
