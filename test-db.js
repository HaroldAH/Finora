const db = require("./database");

async function test() {
  try {
    const result = await db.query("SELECT NOW() AS ahora");
    console.log("✅ Conexión exitosa:", result.rows[0].ahora);
    process.exit(0);
  } catch (err) {
    console.error("❌ Fallo la conexión:", err.message);
    process.exit(1);
  }
}

test();
