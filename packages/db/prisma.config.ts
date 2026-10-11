import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Real credentials live in .env.local at the repo root (gitignored). See /.env.example.
config({ path: "../../.env.local" });
config({ path: "../../.env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations and the seed run as the owner role. The app connects with DATABASE_URL (restricted role).
    url: process.env.DIRECT_URL ?? "",
  },
});
