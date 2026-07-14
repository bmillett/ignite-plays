import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

const email = process.argv[2];
if (!email) {
  console.error('Usage: node seed-admin.mjs your@email.com');
  process.exit(1);
}

await sql`INSERT INTO users (email, role) VALUES (${email}, 'admin') ON CONFLICT (email) DO NOTHING`;
console.log(`✓ Admin user seeded: ${email}`);
await sql.end();
