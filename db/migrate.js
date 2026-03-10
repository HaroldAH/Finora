const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("🔄 Ejecutando migraciones...");

    // 1. Tabla capital (cuenta del usuario)
    await client.query(`
      CREATE TABLE IF NOT EXISTS capital (
        id     INT PRIMARY KEY DEFAULT 1,
        monto  NUMERIC(14,2) NOT NULL DEFAULT 0,
        updated_en TIMESTAMP DEFAULT NOW(),
        CHECK (id = 1)
      )
    `);
    console.log("✅ Tabla 'capital' creada o ya existente");

    // 2. Insertar fila inicial si no existe
    await client.query(`
      INSERT INTO capital (id, monto) VALUES (1, 0)
      ON CONFLICT (id) DO NOTHING
    `);
    console.log("✅ Fila inicial de capital verificada");

    // 3. Agregar columna motivo a gastos (si no existe)
    await client.query(`
      ALTER TABLE gastos ADD COLUMN IF NOT EXISTS motivo VARCHAR(255) DEFAULT ''
    `);
    console.log("✅ Columna 'motivo' en gastos verificada");

    // 4. Tabla cursos (aula virtual)
    await client.query(`
      CREATE TABLE IF NOT EXISTS cursos (
        id          SERIAL PRIMARY KEY,
        nombre      VARCHAR(100) NOT NULL,
        descripcion TEXT         DEFAULT '',
        color       VARCHAR(20)  DEFAULT '#f97316',
        creado_en   TIMESTAMP    DEFAULT NOW()
      )
    `);
    console.log("✅ Tabla 'cursos' creada o ya existente");

    // 5. Tabla evaluaciones (calificaciones por curso)
    await client.query(`
      CREATE TABLE IF NOT EXISTS evaluaciones (
        id         SERIAL PRIMARY KEY,
        curso_id   INT NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
        nombre     VARCHAR(200) NOT NULL,
        peso       NUMERIC(5,2) NOT NULL DEFAULT 0,
        nota       NUMERIC(5,2),
        creado_en  TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("✅ Tabla 'evaluaciones' creada o ya existente");

    console.log("✅ Migraciones completadas correctamente");
  } catch (err) {
    console.error("❌ Error en migración:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
