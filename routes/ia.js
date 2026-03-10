const express  = require("express");
const router   = express.Router();
const multer   = require("multer");
const Groq     = require("groq-sdk");

let pdfParse, mammoth;
try { pdfParse = require("pdf-parse"); } catch (e) {}
try { mammoth  = require("mammoth");   } catch (e) {}

const SUPPORTED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/") || SUPPORTED_MIME.has(file.mimetype))
      cb(null, true);
    else
      cb(new Error("Solo se aceptan imagenes (JPG, PNG, WEBP), PDF o Word (.docx)"), false);
  },
});

function buildPrompt() {
  const hoy = new Date().toISOString().substring(0, 10);
  return `Eres un asistente que extrae informacion academica universitaria de imagenes y documentos.
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
    return res.status(400).json({ error: "No se recibieron archivos." });
  }

  try {
    const imageFiles = req.files.filter(f => f.mimetype.startsWith("image/"));
    const docFiles   = req.files.filter(f => SUPPORTED_MIME.has(f.mimetype));

    // Extract text from documents
    let docText = "";
    for (const f of docFiles) {
      try {
        if (f.mimetype === "application/pdf" && pdfParse) {
          const pdfData = await pdfParse(f.buffer);
          docText += `\n\n[PDF: ${f.originalname}]\n${pdfData.text.substring(0, 8000)}`;
        } else if (SUPPORTED_MIME.has(f.mimetype) && f.mimetype !== "application/pdf" && mammoth) {
          const result = await mammoth.extractRawText({ buffer: f.buffer });
          docText += `\n\n[Word: ${f.originalname}]\n${result.value.substring(0, 8000)}`;
        }
      } catch (docErr) {
        console.warn("[IA] Error extrayendo doc:", f.originalname, docErr.message);
      }
    }

    const groq  = new Groq({ apiKey: GROQ_KEY });
    const model = imageFiles.length > 0
      ? "meta-llama/llama-4-scout-17b-16e-instruct"
      : "llama-3.3-70b-versatile";

    const text    = buildPrompt() + (docText ? "\n\nContenido de documentos:\n" + docText : "");
    const content = [
      { type: "text", text },
      ...imageFiles.map(f => ({
        type: "image_url",
        image_url: { url: `data:${f.mimetype};base64,${f.buffer.toString("base64")}` },
      })),
    ];

    const response = await groq.chat.completions.create({
      model,
      messages: [{ role: "user", content }],
      max_tokens: 2000,
    });

    const rawText = response.choices[0].message.content.trim();
    const jsonStr = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const raw     = JSON.parse(jsonStr);
    const COLORS  = ["#f97316","#3b82f6","#22c55e","#a855f7","#ef4444","#eab308","#06b6d4","#ec4899"];

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
