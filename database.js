const { Pool, types } = require("pg");
require("dotenv").config();

// Always return DATE columns as plain "YYYY-MM-DD" strings
// (avoids timezone shifts and Invalid Date in the browser)
types.setTypeParser(1082, val => val);

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

pool.connect()
  .then(() => console.log("✅ Conectado a CockroachDB"))
  .catch(err => console.error("❌ Error de conexión:", err.message));

module.exports = pool;
