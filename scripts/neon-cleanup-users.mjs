#!/usr/bin/env node
/**
 * Keep only one user on Neon; promote them to platform owner.
 *
 *   DATABASE_URL=postgres://... node scripts/neon-cleanup-users.mjs officialnexus265@gmail.com
 */
import pg from "pg";

const email = (process.argv[2] || "officialnexus265@gmail.com").trim().toLowerCase();
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Set DATABASE_URL to your Neon connection string.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    await client.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS is_platform_owner boolean NOT NULL DEFAULT false`,
    );

    const keep = await client.query(
      `SELECT id, email FROM "user" WHERE lower(email) = $1`,
      [email],
    );
    if (!keep.rows[0]) {
      console.error(`No user found with email ${email}. Create/sign-up that account first.`);
      process.exit(1);
    }
    const keepId = keep.rows[0].id;
    console.log("Keeping:", keep.rows[0].email, keepId);

    const others = await client.query(
      `SELECT id, email FROM "user" WHERE lower(email) <> $1`,
      [email],
    );
    console.log(`Deleting ${others.rows.length} other user(s)…`);

    for (const u of others.rows) {
      await client.query(`DELETE FROM session WHERE "userId" = $1`, [u.id]).catch(() => {});
      await client.query(`DELETE FROM account WHERE "userId" = $1`, [u.id]).catch(() => {});
      await client.query(`DELETE FROM "user" WHERE id = $1`, [u.id]);
      console.log("  deleted", u.email);
    }

    await client.query(`UPDATE "user" SET is_platform_owner = false`);
    await client.query(
      `UPDATE "user" SET is_platform_owner = true WHERE id = $1`,
      [keepId],
    );

    const verify = await client.query(
      `SELECT email, is_platform_owner FROM "user" ORDER BY email`,
    );
    console.log("Remaining users:");
    for (const r of verify.rows) {
      console.log(" ", r.email, "platform_owner=", r.is_platform_owner);
    }
    console.log("Done.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
