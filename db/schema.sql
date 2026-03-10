-- =============================================
-- SISTEMA DE HORARIOS Y MANEJO DE DINERO
-- Schema de base de datos: sistema_vida
-- =============================================

-- Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Ingresos
CREATE TABLE IF NOT EXISTS ingresos (
  id SERIAL PRIMARY KEY,
  descripcion VARCHAR(255) NOT NULL,
  monto NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
  categoria VARCHAR(100) DEFAULT 'General',
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Gastos
CREATE TABLE IF NOT EXISTS gastos (
  id SERIAL PRIMARY KEY,
  descripcion VARCHAR(255) NOT NULL,
  monto NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
  categoria VARCHAR(100) DEFAULT 'General',
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Presupuesto diario
CREATE TABLE IF NOT EXISTS presupuesto_diario (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
  limite NUMERIC(12, 2) NOT NULL CHECK (limite > 0),
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Tareas universitarias
CREATE TABLE IF NOT EXISTS tareas (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  materia VARCHAR(100),
  fecha_entrega DATE,
  prioridad VARCHAR(20) DEFAULT 'media' CHECK (prioridad IN ('alta', 'media', 'baja')),
  completada BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Eventos / Calendario
CREATE TABLE IF NOT EXISTS eventos (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  tipo VARCHAR(50) DEFAULT 'general' CHECK (tipo IN ('general', 'financiero', 'academico', 'personal')),
  fecha_inicio TIMESTAMP NOT NULL,
  fecha_fin TIMESTAMP,
  color VARCHAR(20) DEFAULT '#f97316',
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_ingresos_fecha ON ingresos(fecha);
CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos(fecha);
CREATE INDEX IF NOT EXISTS idx_tareas_fecha ON tareas(fecha_entrega);
CREATE INDEX IF NOT EXISTS idx_eventos_fecha ON eventos(fecha_inicio);

-- Vista: resumen financiero del mes actual
CREATE OR REPLACE VIEW resumen_mes AS
SELECT
  COALESCE((SELECT SUM(monto) FROM ingresos WHERE DATE_TRUNC('month', fecha) = DATE_TRUNC('month', NOW())), 0) AS total_ingresos,
  COALESCE((SELECT SUM(monto) FROM gastos WHERE DATE_TRUNC('month', fecha) = DATE_TRUNC('month', NOW())), 0) AS total_gastos,
  COALESCE((SELECT SUM(monto) FROM ingresos WHERE DATE_TRUNC('month', fecha) = DATE_TRUNC('month', NOW())), 0)
  - COALESCE((SELECT SUM(monto) FROM gastos WHERE DATE_TRUNC('month', fecha) = DATE_TRUNC('month', NOW())), 0) AS balance;
