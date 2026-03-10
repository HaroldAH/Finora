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

const schema = `
DROP TABLE IF EXISTS eventos CASCADE;
DROP TABLE IF EXISTS tareas CASCADE;
DROP TABLE IF EXISTS presupuesto_diario CASCADE;
DROP TABLE IF EXISTS gastos CASCADE;
DROP TABLE IF EXISTS ingresos CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP VIEW IF EXISTS resumen_mes;

CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE,
  creado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ingresos (
  id SERIAL PRIMARY KEY,
  descripcion VARCHAR(255) NOT NULL,
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  categoria VARCHAR(100) DEFAULT 'General',
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  creado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE gastos (
  id SERIAL PRIMARY KEY,
  descripcion VARCHAR(255) NOT NULL,
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  categoria VARCHAR(100) DEFAULT 'General',
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  creado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE presupuesto_diario (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
  limite NUMERIC(12,2) NOT NULL CHECK (limite > 0),
  creado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tareas (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  materia VARCHAR(100),
  fecha_entrega DATE,
  prioridad VARCHAR(20) DEFAULT 'media' CHECK (prioridad IN ('alta','media','baja')),
  completada BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE eventos (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  tipo VARCHAR(50) DEFAULT 'general' CHECK (tipo IN ('general','financiero','academico','personal')),
  fecha_inicio TIMESTAMP NOT NULL,
  fecha_fin TIMESTAMP,
  color VARCHAR(20) DEFAULT '#f97316',
  creado_en TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingresos_fecha ON ingresos(fecha);
CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos(fecha);
CREATE INDEX IF NOT EXISTS idx_tareas_fecha ON tareas(fecha_entrega);
CREATE INDEX IF NOT EXISTS idx_eventos_fecha ON eventos(fecha_inicio);

CREATE VIEW resumen_mes AS
SELECT
  COALESCE((SELECT SUM(monto) FROM ingresos WHERE DATE_TRUNC('month',fecha)=DATE_TRUNC('month',NOW())),0) AS total_ingresos,
  COALESCE((SELECT SUM(monto) FROM gastos WHERE DATE_TRUNC('month',fecha)=DATE_TRUNC('month',NOW())),0) AS total_gastos,
  COALESCE((SELECT SUM(monto) FROM ingresos WHERE DATE_TRUNC('month',fecha)=DATE_TRUNC('month',NOW())),0)
  - COALESCE((SELECT SUM(monto) FROM gastos WHERE DATE_TRUNC('month',fecha)=DATE_TRUNC('month',NOW())),0) AS balance;
`;

async function init() {
  const client = await pool.connect();
  try {
    console.log("⏳ Aplicando schema...");
    // CockroachDB executes each statement separately
    const statements = schema
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        await client.query(stmt);
        const label = stmt.split("\n")[0].substring(0, 60);
        console.log(`  ✓ ${label}`);
      } catch (err) {
        console.warn(`  ⚠ ${err.message.split("\n")[0]}`);
      }
    }
    console.log("\n✅ Schema aplicado en CockroachDB");
  } finally {
    client.release();
    await pool.end();
  }
}

init().catch(err => {
  console.error("❌ Error fatal:", err.message);
  process.exit(1);
});
