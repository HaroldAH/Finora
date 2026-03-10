const express = require("express");
const router  = express.Router();
const multer  = require("multer");
const Groq    = require("groq-sdk");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Solo se aceptan imagenes"), false);
  },
});

function buildPrompt() {
  const hoy = new Date().toISOString().substring(0, 10);
  return `Eres un asistente que extrae informacion academica universitaria de imagenes.
Hoy es ${hoy}.
Responde UNICAMENTE con JSON valido sin markdown:
{"cursos":[{"nombre":"...","descripcion":"...","color":"#HEX"}],"tareas":[{"titulo":"...","materia":"...","fecha_entrega":"YYYY-MM-DD o null","prioridad":"alta|media|baja","descripcion":"..."}]}
Colores disponibles: #f97316 #3b82f6 #22c55e #a855f7 #ef4444 #eab308 #06b6d4 #ec4899
alta=examen/parcial/<=7dias, media=1-2semanas, baja=sin fecha`;
}

router.post("/analizar", upload.array("archivos", 5), async (req, res) => {
  const GROQ_KEY = (req.headers["x-groq-key"] || "").trim()
                || (process.env.GROQ_API_KEY   || "").trim();

  if (!GROQ_KEY) {
    return res.status(503).json({ error: "Ingresa tu clave de Groq en el campo del modal (console.groq.com/keys)." });
  }
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No se recibieron imagenes." });
  }

  try {
    const groq = new Groq({ apiKey: GROQ_KEY });
    const response = await groq.chat.completions.create({
      model: "llama-3.2-11b-vision-preview",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: buildPrompt() },
          ...req.files.map(f => ({
            type: "image_url",
            image_url: { url: `data:${f.mimetype};base64,${f.buffer.toString("base64")}` },
          })),
        ],
      }],
      max_tokens: 2000,
    });

    const rawText = response.choices[0].message.content.trim();
    const jsonStr = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const raw = JSON.parse(jsonStr);
    const COLORS = ["#f97316","#3b82f6","#22c55e","#a855f7","#ef4444","#eab308","#06b6d4","#ec4899"];

    const cursos = (Array.isArray(raw.cursos) ? raw.cursos : [])
      .map((c, i) => ({
        nombre:      String(c.nombre      || "").trim().slice(0, 100),
        descripcion: String(c.descripcion || "").trim().slice(0, 200),
        color: /^#[0-9a-fA-F]{6}$/.test(c.color) ? c.color : COLORS[i % COLORS.length],
      })).filter(c => c.nombre.length > 0);

    const tareas = (Array.isArray(raw.tareas) ? raw.tareas : [])
      .map(t => ({
        titulo:        String(t.titulo      || "").trim().slice(0, 200),
        materia:       String(t.materia     || "").trim().slice(0, 100),
        descripcion:   String(t.descripcion || "").trim().slice(0, 300),
        fecha_entrega: /^\d{4}-\d{2}-\d{2}$/.test(t.fecha_entrega) ? t.fecha_entrega : null,
        prioridad:     ["alta","media","baja"].includes(t.prioridad) ? t.prioridad : "media",
      })).filter(t => t.titulo.length > 0);

    res.json({ cursos, tareas });
  } catch (err) {
    console.error("[IA]", err.status, err.message, JSON.stringify(err.error));
    const msg = err?.error?.error?.message || err?.message || "desconocido";
    res.status(500).json({ error: "Error al analizar: " + msg });
  }
});

module.exports = router;
