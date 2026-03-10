const express = require("express");
const router  = express.Router();
const db      = require("../database");

// GET — capital + computed fields
// capital.monto es el saldo vivo: se actualiza al crear/borrar ingresos y gastos
router.get("/", async (req, res) => {
  try {
    const [capRow, comprRow] = await Promise.all([
      db.query("SELECT monto FROM capital WHERE id = 1"),
      db.query(
        "SELECT COALESCE(SUM(limite), 0) AS total FROM presupuesto_diario WHERE fecha >= CURRENT_DATE"
      ),
    ]);

    const capital      = capRow.rows.length > 0 ? parseFloat(capRow.rows[0].monto) : 0;
    const comprometido = parseFloat(comprRow.rows[0].total);
    const disponible   = capital - comprometido;

    res.json({ capital, presupuestado: comprometido, disponible });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT — set capital amount
router.put("/", async (req, res) => {
  const { monto } = req.body;
  if (monto === undefined || isNaN(Number(monto))) {
    return res.status(400).json({ error: "monto es requerido" });
  }
  try {
    await db.query(
      `INSERT INTO capital (id, monto) VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET monto = $1, updated_en = NOW()`,
      [monto]
    );
    res.json({ message: "Capital actualizado", monto: parseFloat(monto) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
