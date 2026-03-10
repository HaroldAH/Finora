const express = require("express");
const router = express.Router();
const db = require("../database");

// GET todas las tareas
router.get("/", async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM tareas ORDER BY completada ASC,
       CASE prioridad WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
       fecha_entrega ASC NULLS LAST`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET tareas pendientes
router.get("/pendientes", async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM tareas WHERE completada = FALSE
       ORDER BY CASE prioridad WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
       fecha_entrega ASC NULLS LAST`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST nueva tarea
router.post("/", async (req, res) => {
  const { titulo, descripcion, materia, fecha_entrega, prioridad } = req.body;
  if (!titulo) return res.status(400).json({ error: "titulo es requerido" });
  try {
    const { rows } = await db.query(
      `INSERT INTO tareas (titulo, descripcion, materia, fecha_entrega, prioridad)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [titulo, descripcion || null, materia || null, fecha_entrega || null, prioridad || "media"]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET tarea por id
router.get("/:id", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM tareas WHERE id=$1", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "No encontrado" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH marcar como completada/pendiente
router.patch("/:id/completar", async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query(
      `UPDATE tareas SET completada = NOT completada WHERE id=$1 RETURNING *`, [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "No encontrado" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT actualizar tarea
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { titulo, descripcion, materia, fecha_entrega, prioridad, completada } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE tareas SET titulo=$1, descripcion=$2, materia=$3,
       fecha_entrega=$4, prioridad=$5, completada=$6
       WHERE id=$7 RETURNING *`,
      [titulo, descripcion, materia, fecha_entrega, prioridad, completada, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "No encontrado" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE tarea
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await db.query("DELETE FROM tareas WHERE id=$1", [id]);
    if (rowCount === 0) return res.status(404).json({ error: "No encontrado" });
    res.json({ message: "Eliminado correctamente" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
