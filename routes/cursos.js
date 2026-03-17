const express = require("express");
const router  = express.Router();
const db      = require("../database");

// GET todos los cursos
router.get("/", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM cursos ORDER BY nombre");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST nuevo curso
router.post("/", async (req, res) => {
  const { nombre, descripcion, color } = req.body;
  if (!nombre) return res.status(400).json({ error: "nombre es requerido" });
  try {
    const { rows } = await db.query(
      `INSERT INTO cursos (nombre, descripcion, color) VALUES ($1, $2, $3) RETURNING *`,
      [nombre.trim(), descripcion || "", color || "#f97316"]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT actualizar curso
router.put("/:id", async (req, res) => {
  const { nombre, descripcion, color } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE cursos SET nombre=$1, descripcion=$2, color=$3 WHERE id=$4 RETURNING *`,
      [nombre, descripcion || "", color || "#f97316", req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "No encontrado" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE curso
router.delete("/:id", async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "ID de curso inválido" });
  }

  try {
    const { rowCount } = await db.query("DELETE FROM cursos WHERE id=$1", [id]);
    if (rowCount === 0) return res.status(404).json({ error: `Curso no encontrado (id: ${id})` });
    res.json({ message: "Eliminado" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── EVALUACIONES ────────────────────────────────────────────────────────────

// GET todas las evaluaciones de todos los cursos (para cargar el aula de un solo hit)
router.get("/all-evaluaciones", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM evaluaciones ORDER BY curso_id, id");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET evaluaciones de un curso específico
router.get("/:id/evaluaciones", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM evaluaciones WHERE curso_id=$1 ORDER BY id",
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST nueva evaluación para un curso
router.post("/:id/evaluaciones", async (req, res) => {
  const { nombre, peso } = req.body;
  if (!nombre || peso == null) return res.status(400).json({ error: "nombre y peso son requeridos" });
  try {
    const { rows } = await db.query(
      "INSERT INTO evaluaciones (curso_id, nombre, peso) VALUES ($1, $2, $3) RETURNING *",
      [req.params.id, nombre.trim(), parseFloat(peso)]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT actualizar evaluación (puede actualizar nombre, peso o nota)
router.put("/evaluaciones/:evalId", async (req, res) => {
  const { nombre, peso, nota } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE evaluaciones
         SET nombre = COALESCE($1, nombre),
             peso   = COALESCE($2, peso),
             nota   = $3
       WHERE id = $4
       RETURNING *`,
      [
        nombre || null,
        peso != null ? parseFloat(peso) : null,
        nota != null ? parseFloat(nota) : null,
        req.params.evalId,
      ]
    );
    if (rows.length === 0) return res.status(404).json({ error: "No encontrado" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE evaluación
router.delete("/evaluaciones/:evalId", async (req, res) => {
  try {
    const { rowCount } = await db.query("DELETE FROM evaluaciones WHERE id=$1", [req.params.evalId]);
    if (rowCount === 0) return res.status(404).json({ error: "No encontrado" });
    res.json({ message: "Eliminado" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
