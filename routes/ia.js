const express = require("express");
const router  = express.Router();
const multer  = require("multer");
const { OpenAI } = require("openai");

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
  // Verificar que la API key esté configurada
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.trim() === "") {
    return res.status(503).json({
      error: "La clave de OpenAI no está configurada. Agrega OPENAI_API_KEY en las Variables de Railway.",
    });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No se recibieron imágenes." });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Construir el mensaje: texto + imágenes en base64
    const contentParts = [
      { type: "text", text: "Analiza estas imágenes académicas y extrae cursos y tareas pendientes:" },
      ...req.files.map(f => ({
        type: "image_url",
        image_url: {
          url: `data:${f.mimetype};base64,${f.buffer.toString("base64")}`,
          detail: "high",
        },
      })),
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildPrompt() },
        { role: "user",   content: contentParts },
      ],
      max_tokens: 2000,
    });

    const raw = JSON.parse(completion.choices[0].message.content);
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
