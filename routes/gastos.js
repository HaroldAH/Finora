const express = require("express");
const router = express.Router();
const db = require("../database");

// GET todos los gastos
router.get("/", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM gastos ORDER BY fecha DESC, creado_en DESC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET gastos del mes
router.get("/mes", async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM gastos
       WHERE DATE_TRUNC('month', fecha) = DATE_TRUNC('month', NOW())
       ORDER BY fecha DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET gastos por categoría
router.get("/categorias", async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT categoria, SUM(monto) AS total, COUNT(*) AS cantidad
       FROM gastos
       WHERE DATE_TRUNC('month', fecha) = DATE_TRUNC('month', NOW())
       GROUP BY categoria ORDER BY total DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST nuevo gasto
router.post("/", async (req, res) => {
  const { descripcion, monto, categoria, fecha, motivo } = req.body;
  if (!monto) {
    return res.status(400).json({ error: "monto es requerido" });
  }
  try {
    const { rows } = await db.query(
      `INSERT INTO gastos (descripcion, monto, categoria, fecha, motivo)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        descripcion || "",
        monto,
        categoria || "Otro",
        fecha || new Date().toISOString().split("T")[0],
        motivo || "",
      ]
    );
    // Restar del capital
    await db.query(
      "UPDATE capital SET monto = monto - $1, updated_en = NOW() WHERE id = 1",
      [monto]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT actualizar gasto
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { descripcion, monto, categoria, fecha, motivo } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE gastos SET descripcion=$1, monto=$2, categoria=$3, fecha=$4, motivo=$5
       WHERE id=$6 RETURNING *`,
      [descripcion || "", monto, categoria, fecha, motivo || "", id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "No encontrado" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE gasto
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const sel = await db.query("SELECT monto FROM gastos WHERE id=$1", [id]);
    if (sel.rows.length === 0) return res.status(404).json({ error: "No encontrado" });
    const monto = parseFloat(sel.rows[0].monto);
    await db.query("DELETE FROM gastos WHERE id=$1", [id]);
    // Devolver al capital (se revierte el gasto)
    await db.query(
      "UPDATE capital SET monto = monto + $1, updated_en = NOW() WHERE id = 1",
      [monto]
    );
    res.json({ message: "Eliminado correctamente" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
