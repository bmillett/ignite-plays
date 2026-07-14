# 🥏 Ultimate Plays

A web app for designing, sharing, and animating ultimate frisbee plays with your team.

---

## Features

- **Play designer** — top-down field view with 7 offense (blue) and 7 defense (red) players plus a disc
- **Drag & drop** — drag players and the disc onto the field from the staging area
- **Step-based editing** — build plays step by step; arrows show movement between steps
- **Animation** — play back the full sequence with smooth transitions and ghost trail arrows
- **Tags** — categorize plays and filter the library by tag
- **Team sharing** — all authorized users share the same play library
- **Access control** — email allowlist with member and admin roles

---

## Getting Started (Local Development)

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or later
- A Postgres database — local or free [Neon](https://neon.tech) cloud database

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in the four values:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Postgres connection string |
| `TEAM_PASSWORD` | Shared password for all team members to log in |
| `ADMIN_PASSWORD` | Separate password for admin accounts |
| `SESSION_SECRET` | Random string, minimum 32 characters |

To generate a session secret:
```bash
openssl rand -hex 32
```

### 3. Push the database schema
```bash
npm run db:push
```

### 4. Seed the first admin user
```bash
node seed-admin.mjs your@email.com
```

### 5. Start the dev server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with your email and the `ADMIN_PASSWORD`.

---

## Deploying to Vercel + Neon

1. Create a free project at [neon.tech](https://neon.tech) and copy the connection string
2. Set `DATABASE_URL` in `.env.local` and run `npm run db:push` to apply the schema
3. Seed your admin user: `node seed-admin.mjs your@email.com`
4. Push the code to GitHub
5. Create a new project at [vercel.com](https://vercel.com) and import the repo
6. Add all four environment variables in the Vercel project settings
7. Deploy — Vercel auto-deploys on every push to `main`
8. Go to `/admin/users` to add your team members

---

## Useful Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start local development server |
| `npm run build` | Build for production |
| `npm run db:push` | Push schema changes to the database |
| `npm run db:studio` | Open Drizzle Studio to browse the database |
| `node seed-admin.mjs <email>` | Seed an admin user directly |

---

## Access Control

- **Members** log in with their email + `TEAM_PASSWORD`
- **Admins** log in with their email + `ADMIN_PASSWORD`
- Only emails in the allowlist can log in — add them at `/admin/users`
- Admins can add/remove users and see the ⚙️ Admin link in the nav bar
