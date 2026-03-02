/**
 * Script pour créer un compte administrateur local dans AgilesTest.
 * Insère directement dans MySQL avec un mot de passe hashé via bcrypt.
 */
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

async function main() {
  const ADMIN_EMAIL = "admin@agilestest.local";
  const ADMIN_PASSWORD = "Admin@2026!";
  const ADMIN_NAME = "Administrateur";
  const ADMIN_OPEN_ID = `admin_${crypto.randomUUID()}`;

  console.log("[Admin Setup] Connecting to MySQL...");

  const connection = await mysql.createConnection({
    host: "127.0.0.1",
    port: 3307,
    user: "agilestest",
    password: "agilestest123",
    database: "agilestest",
  });

  console.log("[Admin Setup] Connected to MySQL.");

  // Check if admin user already exists
  const [existing] = await connection.execute(
    "SELECT id, email, role FROM users WHERE email = ?",
    [ADMIN_EMAIL]
  );

  if (existing.length > 0) {
    console.log("[Admin Setup] Admin user already exists:", existing[0]);
    // Update the password and ensure admin role
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await connection.execute(
      "UPDATE users SET password_hash = ?, role = 'admin', status = 'ACTIVE', full_name = ?, name = ? WHERE email = ?",
      [passwordHash, ADMIN_NAME, ADMIN_NAME, ADMIN_EMAIL]
    );
    console.log("[Admin Setup] Admin password and role updated.");
  } else {
    // Create new admin user
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await connection.execute(
      `INSERT INTO users (openId, name, email, loginMethod, role, full_name, status, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ADMIN_OPEN_ID,
        ADMIN_NAME,
        ADMIN_EMAIL,
        "invite",
        "admin",
        ADMIN_NAME,
        "ACTIVE",
        passwordHash,
      ]
    );
    console.log("[Admin Setup] Admin user created successfully.");
  }

  // Verify the user
  const [verify] = await connection.execute(
    "SELECT id, openId, name, email, role, status, full_name FROM users WHERE email = ?",
    [ADMIN_EMAIL]
  );
  console.log("[Admin Setup] Verification:", verify[0]);

  // Also set OWNER_OPEN_ID in case it's needed
  console.log("\n[Admin Setup] ========================================");
  console.log("[Admin Setup] Compte administrateur configuré :");
  console.log("[Admin Setup]   Email    : " + ADMIN_EMAIL);
  console.log("[Admin Setup]   Password : " + ADMIN_PASSWORD);
  console.log("[Admin Setup]   Role     : admin");
  console.log("[Admin Setup]   OpenID   : " + (verify[0]?.openId || ADMIN_OPEN_ID));
  console.log("[Admin Setup] ========================================");

  await connection.end();
}

main().catch((err) => {
  console.error("[Admin Setup] Error:", err);
  process.exit(1);
});
