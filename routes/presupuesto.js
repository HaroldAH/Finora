const express = require("express");
const router = express.Router();
const db = require("../database");

// GET resumen financiero completo
router.get("/resumen", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM resumen_mes");
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET predicción fin de mes
router.get("/prediccion", async (req, res) => {
  try {
    const hoy = new Date();
    const diasEnMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    const diasTranscurridos = hoy.getDate();
    const diasRestantes = diasEnMes - diasTranscurridos;

    const { rows: gastoRows } = await db.query(
      `SELECT COALESCE(SUM(monto), 0) AS total_gastado
       FROM gastos
       WHERE DATE_TRUNC('month', fecha) = DATE_TRUNC('month', NOW())`
    );
    const { rows: ingresoRows } = await db.query(
      `SELECT COALESCE(SUM(monto), 0) AS total_ingresado
       FROM ingresos
       WHERE DATE_TRUNC('month', fecha) = DATE_TRUNC('month', NOW())`
    );

    const totalGastado = parseFloat(gastoRows[0].total_gastado);
    const totalIngresado = parseFloat(ingresoRows[0].total_ingresado);
    const promedioGastoDiario = diasTranscurridos > 0 ? totalGastado / diasTranscurridos : 0;
    const prediccionGastoFinal = promedioGastoDiario * diasEnMes;
    const prediccionBalance = totalIngresado - prediccionGastoFinal;

    res.json({
      total_ingresado: totalIngresado,
      total_gastado: totalGastado,
      dias_transcurridos: diasTranscurridos,
      dias_restantes: diasRestantes,
      promedio_gasto_diario: promedioGastoDiario.toFixed(2),
      prediccion_gasto_final: prediccionGastoFinal.toFixed(2),
      prediccion_balance: prediccionBalance.toFixed(2),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET presupuesto del día
router.get("/hoy", async (req, res) => {
  const hoy = new Date().toISOString().split("T")[0];
  try {
    const { rows: presupuesto } = await db.query(
      "SELECT * FROM presupuesto_diario WHERE fecha = $1", [hoy]
    );
    const { rows: gastos } = await db.query(
      "SELECT COALESCE(SUM(monto), 0) AS gastado_hoy FROM gastos WHERE fecha = $1", [hoy]
    );
    const limite = presupuesto[0] ? parseFloat(presupuesto[0].limite) : null;
    const gastadoHoy = parseFloat(gastos[0].gastado_hoy);
    res.json({
      fecha: hoy,
      limite,
      gastado_hoy: gastadoHoy,
      disponible: limite !== null ? (limite - gastadoHoy).toFixed(2) : null,
      excedido: limite !== null ? gastadoHoy > limite : false,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET todos los presupuestos diarios del mes
router.get("/mes", async (req, res) => {
  const { year, month } = req.query;
  const y = year || new Date().getFullYear();
  const m = month || new Date().getMonth() + 1;
  try {
    const { rows } = await db.query(
      `SELECT * FROM presupuesto_diario
       WHERE EXTRACT(YEAR FROM fecha) = $1
       AND EXTRACT(MONTH FROM fecha) = $2
       ORDER BY fecha ASC`,
      [y, m]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST o PUT límite diario (0 o vacío = borrar)
router.post("/limite", async (req, res) => {
  const { fecha, limite } = req.body;
  const fechaFinal = fecha || new Date().toISOString().split("T")[0];
  const limiteNum = parseFloat(limite);
  try {
    if (isNaN(limiteNum) || limiteNum <= 0) {
      // 0 o vacío → eliminar presupuesto del día
      await db.query("DELETE FROM presupuesto_diario WHERE fecha = $1", [fechaFinal]);
      return res.json({ message: "Presupuesto eliminado", fecha: fechaFinal, limite: null });
    }
    const { rows } = await db.query(
      `INSERT INTO presupuesto_diario (fecha, limite)
       VALUES ($1, $2)
       ON CONFLICT (fecha) DO UPDATE SET limite = EXCLUDED.limite
       RETURNING *`,
      [fechaFinal, limiteNum]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
