const express = require("express");
const router = express.Router();
const db = require("../database");

// GET todos los eventos
router.get("/", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM eventos ORDER BY fecha_inicio ASC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET eventos del mes
router.get("/mes", async (req, res) => {
  const { year, month } = req.query;
  const y = year || new Date().getFullYear();
  const m = month || new Date().getMonth() + 1;
  try {
    const { rows } = await db.query(
      `SELECT * FROM eventos
       WHERE EXTRACT(YEAR FROM fecha_inicio) = $1
       AND EXTRACT(MONTH FROM fecha_inicio) = $2
       ORDER BY fecha_inicio ASC`,
      [y, m]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST nuevo evento
router.post("/", async (req, res) => {
  const { titulo, descripcion, tipo, fecha_inicio, fecha_fin, color } = req.body;
  if (!titulo || !fecha_inicio) {
    return res.status(400).json({ error: "titulo y fecha_inicio son requeridos" });
  }
  try {
    const { rows } = await db.query(
      `INSERT INTO eventos (titulo, descripcion, tipo, fecha_inicio, fecha_fin, color)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [titulo, descripcion || null, tipo || "general", fecha_inicio, fecha_fin || null, color || "#f97316"]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT actualizar evento
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { titulo, descripcion, tipo, fecha_inicio, fecha_fin, color } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE eventos SET titulo=$1, descripcion=$2, tipo=$3,
       fecha_inicio=$4, fecha_fin=$5, color=$6
       WHERE id=$7 RETURNING *`,
      [titulo, descripcion, tipo, fecha_inicio, fecha_fin, color, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "No encontrado" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE evento
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await db.query("DELETE FROM eventos WHERE id=$1", [id]);
    if (rowCount === 0) return res.status(404).json({ error: "No encontrado" });
    res.json({ message: "Eliminado correctamente" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
