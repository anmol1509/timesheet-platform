This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Local database

Set `DATABASE_URL` (Postgres) and `SESSION_SECRET`, then build the database from the migrations, never with `prisma db push`:

```bash
npx prisma migrate deploy        # creates every table and the MAIN branch
npm run seed                     # super admin demo@manpowersync.com / changeme123
# optional showcase data (clients, workers, demands, camps, expenses, ...)
DEMO_MANIFEST=.demo-manifest.local.json APPLY=1 npx tsx prisma/scripts/seed-demo-data.ts
```

`DEMO_MANIFEST` keeps your run's record of seeded rows in its own file; the committed
`prisma/scripts/demo-data-manifest.json` belongs to the shared environment and makes the seeder refuse to run.

## Migrations on deploy

`npm run build` first runs `scripts/migrate-on-deploy.mjs`, which applies any pending migrations with `prisma migrate deploy`.

- It runs on **production** deploys only (`VERCEL_ENV=production`). Preview builds skip it, so a pull request never touches the live database.
- It uses `POSTGRES_URL_NON_POOLING` when set (migrations need a direct connection), otherwise `DATABASE_URL`.
- If a migration fails, the build stops: the previous deployment stays live and the failed migration is rolled back.
- Write migrations to be safe for the old code too (add columns and tables; drop things in a later release), because the old version serves traffic while the new one builds.
- Locally, `RUN_MIGRATIONS=1 node scripts/migrate-on-deploy.mjs` runs it against `DATABASE_URL`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Third-party data

City names for the emirate/city field come from GeoNames (https://www.geonames.org), licensed under Creative Commons Attribution 4.0. The processed list is in `src/data/cities.json`.
