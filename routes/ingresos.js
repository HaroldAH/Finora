const express = require("express");
const router = express.Router();
const db = require("../database");

// GET todos los ingresos
router.get("/", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM ingresos ORDER BY fecha DESC, creado_en DESC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ingresos del mes
router.get("/mes", async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM ingresos
       WHERE DATE_TRUNC('month', fecha) = DATE_TRUNC('month', NOW())
       ORDER BY fecha DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST nuevo ingreso
router.post("/", async (req, res) => {
  const { descripcion, monto, categoria, fecha } = req.body;
  if (!descripcion || !monto) {
    return res.status(400).json({ error: "descripcion y monto son requeridos" });
  }
  try {
    const { rows } = await db.query(
      `INSERT INTO ingresos (descripcion, monto, categoria, fecha)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [descripcion, monto, categoria || "General", fecha || new Date().toISOString().split("T")[0]]
    );
    // Sumar al capital
    await db.query(
      "UPDATE capital SET monto = monto + $1, updated_en = NOW() WHERE id = 1",
      [monto]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT actualizar ingreso
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { descripcion, monto, categoria, fecha } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE ingresos SET descripcion=$1, monto=$2, categoria=$3, fecha=$4
       WHERE id=$5 RETURNING *`,
      [descripcion, monto, categoria, fecha, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "No encontrado" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE ingreso
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const sel = await db.query("SELECT monto FROM ingresos WHERE id=$1", [id]);
    if (sel.rows.length === 0) return res.status(404).json({ error: "No encontrado" });
    const monto = parseFloat(sel.rows[0].monto);
    await db.query("DELETE FROM ingresos WHERE id=$1", [id]);
    // Restar del capital (se revierte el ingreso)
    await db.query(
      "UPDATE capital SET monto = monto - $1, updated_en = NOW() WHERE id = 1",
      [monto]
    );
    res.json({ message: "Eliminado correctamente" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
