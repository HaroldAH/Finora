const express = require("express");
const router  = express.Router();
const multer  = require("multer");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ── Multer: imágenes en memoria (sin escribir al disco) ──────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB por imagen
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Solo se aceptan imágenes (JPG, PNG, WEBP, etc.)"), false);
    }
  },
});

// ── Prompt del sistema ────────────────────────────────────────────────────────
function buildPrompt() {
  const hoy = new Date().toISOString().substring(0, 10);
  return `Eres un asistente especializado en extraer información académica universitaria.
El usuario sube fotos o capturas de: Moodle, horarios, silabos, WhatsApp, apuntes, listas de tareas, etc.
Hoy es ${hoy}.

Extrae TODOS los cursos y tareas pendientes que identifiques.
Responde ÚNICAMENTE con JSON válido, sin explicaciones, con este formato exacto:

{
  "cursos": [
    { "nombre": "Nombre del curso", "descripcion": "Profesor y/o código si se ve, sino vacío", "color": "#HEX" }
  ],
  "tareas": [
    {
      "titulo": "Título de la tarea o evaluación",
      "materia": "nombre exacto del curso (igual que en cursos)",
      "fecha_entrega": "YYYY-MM-DD o null",
      "prioridad": "alta|media|baja",
      "descripcion": "detalles relevantes si los hay, sino vacío"
    }
  ]
}

Reglas estrictas:
- Colores (asigna uno diferente a cada curso): #f97316 #3b82f6 #22c55e #a855f7 #ef4444 #eab308 #06b6d4 #ec4899
- prioridad "alta"  = examen, parcial, proyecto final, o entrega en ≤ 7 días
- prioridad "media" = tarea regular, entrega en 1–2 semanas
- prioridad "baja"  = lectura, sin fecha clara, actividad ligera
- Si la fecha es relativa ("el viernes", "esta semana"), calcúlala a partir de hoy (${hoy})
- Incluye SOLO tareas NO completadas / pendientes
- Si no hay cursos claros, infiere el nombre desde el contexto`;
}

// ── POST /api/ia/analizar ─────────────────────────────────────────────────────
router.post("/analizar", upload.array("archivos", 5), async (req, res) => {
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY || GEMINI_KEY.trim() === "") {
    const allKeys = Object.keys(process.env).filter(k => k.includes("GEMINI") || k.includes("gemini"));
    return res.status(503).json({
      error: `GEMINI_API_KEY no configurada. Keys con GEMINI en env: [${allKeys.join(",")}]. Total vars: ${Object.keys(process.env).length}`,
    });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No se recibieron imágenes." });
  }

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    // gemini-1.5-flash: gratis, rápido, soporta visión
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Construir partes: prompt de texto + imágenes en base64
    const parts = [
      { text: buildPrompt() },
      ...req.files.map(f => ({
        inlineData: {
          data: f.buffer.toString("base64"),
          mimeType: f.mimetype,
        },
      })),
    ];

    const result  = await model.generateContent(parts);
    const rawText = result.response.text().trim();
    // Quitar posibles bloques ```json ... ``` que el modelo a veces añade
    const jsonStr = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const raw = JSON.parse(jsonStr);
    const COLORS = ["#f97316","#3b82f6","#22c55e","#a855f7","#ef4444","#eab308","#06b6d4","#ec4899"];

    // Sanitizar y validar la respuesta
    const cursos = (Array.isArray(raw.cursos) ? raw.cursos : [])
      .map((c, i) => ({
        nombre:      String(c.nombre      || "").trim().slice(0, 100),
        descripcion: String(c.descripcion || "").trim().slice(0, 200),
        color: /^#[0-9a-fA-F]{6}$/.test(c.color) ? c.color : COLORS[i % COLORS.length],
      }))
      .filter(c => c.nombre.length > 0);

    const tareas = (Array.isArray(raw.tareas) ? raw.tareas : [])
      .map(t => ({
        titulo:       String(t.titulo      || "").trim().slice(0, 200),
        materia:      String(t.materia     || "").trim().slice(0, 100),
        descripcion:  String(t.descripcion || "").trim().slice(0, 300),
        fecha_entrega: /^\d{4}-\d{2}-\d{2}$/.test(t.fecha_entrega) ? t.fecha_entrega : null,
        prioridad:    ["alta","media","baja"].includes(t.prioridad) ? t.prioridad : "media",
      }))
      .filter(t => t.titulo.length > 0);

    res.json({ cursos, tareas });
  } catch (err) {
    console.error("[IA]", err.message);
    res.status(500).json({ error: "Error al analizar: " + (err.message || "desconocido") });
  }
});

module.exports = router;
