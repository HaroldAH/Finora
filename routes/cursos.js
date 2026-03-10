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
  try {
    const { rowCount } = await db.query("DELETE FROM cursos WHERE id=$1", [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: "No encontrado" });
    res.json({ message: "Eliminado" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
