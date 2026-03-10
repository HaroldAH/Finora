const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Rutas API
app.use("/api/capital",    require("./routes/capital"));
app.use("/api/ingresos",   require("./routes/ingresos"));
app.use("/api/gastos",     require("./routes/gastos"));
app.use("/api/presupuesto",require("./routes/presupuesto"));
app.use("/api/tareas",     require("./routes/tareas"));
app.use("/api/eventos",    require("./routes/eventos"));
app.use("/api/cursos",     require("./routes/cursos"));
app.use("/api/ia",         require("./routes/ia"));

// Ruta principal → sirve el frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Manejo de errores 404
app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  // Inicia el sistema de notificaciones por correo
  const { startNotificationScheduler } = require("./notifications");
  startNotificationScheduler();
});
