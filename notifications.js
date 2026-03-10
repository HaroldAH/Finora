const nodemailer = require("nodemailer");
const db = require("./database");

// ── Transport ─────────────────────────────────────────────────────────────────
function createTransport() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

// ── Format helpers ────────────────────────────────────────────────────────────
const fmtDateEs = (d) => {
  const dateOnly = String(d).substring(0, 10);
  return new Date(dateOnly + "T12:00:00").toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
};

// ── Build email HTML ──────────────────────────────────────────────────────────
function buildHtml(items) {
  const rows = items.map(it => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #1e2235">
        ${it.icon} <strong style="color:#f97316">${it.tipo}</strong>
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #1e2235;color:#e2e8f0">
        ${it.titulo}
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #1e2235;color:#94a3b8;white-space:nowrap">
        ${it.fechaLabel}
      </td>
    </tr>`).join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0d0f17;font-family:'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:30px auto;background:#1a1d2e;border-radius:14px;overflow:hidden;border:1px solid #2d3056">
    <div style="background:linear-gradient(135deg,#f97316,#ea580c);padding:28px 28px 22px">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700">📅 Recordatorio del Sistema de Vida</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px">
        Tienes vencimientos próximos que requieren tu atención
      </p>
    </div>
    <div style="padding:22px 28px">
      <p style="color:#94a3b8;font-size:13px;margin:0 0 18px">
        Los siguientes elementos vencen <strong style="color:#f97316">hoy o mañana</strong>:
      </p>
      <table style="width:100%;border-collapse:collapse;background:#0d0f17;border-radius:10px;overflow:hidden">
        <thead>
          <tr>
            <th style="padding:10px 14px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.08em">Tipo</th>
            <th style="padding:10px 14px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.08em">Título</th>
            <th style="padding:10px 14px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.08em">Fecha</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="padding:14px 28px 24px;color:#475569;font-size:11px;border-top:1px solid #1e2235">
      Sistema de Horarios y Manejo de Dinero · Notificación automática
    </div>
  </div>
</body>
</html>`;
}

// ── Core check ────────────────────────────────────────────────────────────────
const sentSet = new Set(); // in-memory dedup: "type:id:YYYY-MM-DD"

async function checkAndNotify() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS ||
      process.env.EMAIL_USER === "TU_EMAIL@gmail.com") {
    return; // not configured yet
  }

  const today = new Date();
  const todayStr    = today.toISOString().split("T")[0];
  const tomorrowStr = new Date(today.getTime() + 86400000).toISOString().split("T")[0];

  try {
    const [tareasRes, eventosRes] = await Promise.all([
      db.query(
        `SELECT id, titulo, materia, prioridad, fecha_entrega FROM tareas
         WHERE completada = FALSE
           AND fecha_entrega IN ($1, $2)`,
        [todayStr, tomorrowStr]
      ),
      db.query(
        `SELECT id, titulo, tipo, fecha_inicio FROM eventos
         WHERE DATE(fecha_inicio) IN ($1, $2)`,
        [todayStr, tomorrowStr]
      ),
    ]);

    const items = [];

    for (const t of tareasRes.rows) {
      const key = `tarea:${t.id}:${todayStr}`;
      if (sentSet.has(key)) continue;
      const fecha = String(t.fecha_entrega).substring(0, 10);
      items.push({
        key,
        icon: "📝",
        tipo: "Tarea" + (t.materia ? ` · ${t.materia}` : ""),
        titulo: `[${t.prioridad.toUpperCase()}] ${t.titulo}`,
        fechaLabel: fmtDateEs(fecha),
      });
    }

    for (const e of eventosRes.rows) {
      const key = `evento:${e.id}:${todayStr}`;
      if (sentSet.has(key)) continue;
      items.push({
        key,
        icon: "📅",
        tipo: `Evento · ${e.tipo}`,
        titulo: e.titulo,
        fechaLabel: fmtDateEs(e.fecha_inicio),
      });
    }

    if (items.length === 0) return;

    const transporter = createTransport();
    await transporter.sendMail({
      from: `"Sistema de Vida 🔔" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO || process.env.EMAIL_USER,
      subject: `🔔 ${items.length} vencimiento${items.length !== 1 ? "s" : ""} próximo${items.length !== 1 ? "s" : ""} — Sistema de Vida`,
      html: buildHtml(items),
    });

    // Mark as sent for this session
    items.forEach(it => sentSet.add(it.key));
    console.log(`📧 Notificación de ${items.length} ítem(s) enviada a ${process.env.EMAIL_TO || process.env.EMAIL_USER}`);
  } catch (err) {
    console.error("❌ Error en notificaciones:", err.message);
  }
}

// ── Scheduler ─────────────────────────────────────────────────────────────────
function startNotificationScheduler() {
  if (!process.env.EMAIL_USER || process.env.EMAIL_USER === "TU_EMAIL@gmail.com") {
    console.log("⚠️  EMAIL_USER no configurado — notificaciones desactivadas");
    return;
  }

  // Run once on startup (after a short delay)
  setTimeout(checkAndNotify, 5000);

  // Then run every day at 08:00 local time
  const scheduleNext = () => {
    const now   = new Date();
    const next8 = new Date(now);
    next8.setHours(8, 0, 0, 0);
    if (next8 <= now) next8.setDate(next8.getDate() + 1);
    const ms = next8 - now;
    console.log(`📅 Próxima revisión de notificaciones: ${next8.toLocaleString("es-ES")}`);
    setTimeout(() => {
      checkAndNotify();
      scheduleNext(); // reschedule for the next day
    }, ms);
  };
  scheduleNext();
}

module.exports = { startNotificationScheduler, checkAndNotify };
