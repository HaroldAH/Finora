/* =============================================
   SISTEMA VIDA — Frontend App Logic
============================================= */

const API = "";  // same origin

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const fmtDate = (d) => {
  if (!d) return "—";
  // CockroachDB may return full timestamps like "2026-03-10T00:00:00.000000Z"
  // Always extract only the YYYY-MM-DD part to avoid Invalid Date
  const dateOnly = String(d).substring(0, 10);
  const dt = new Date(dateOnly + "T12:00:00"); // noon avoids timezone-edge off-by-one
  if (isNaN(dt.getTime())) return String(d).substring(0, 10);
  return dt.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
};

function showToast(msg, type = "info") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => { t.className = "toast"; }, 3200);
}

async function apiFetch(url, opts = {}) {
  const res = await fetch(API + url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error desconocido");
  return data;
}

// ── Navigation ───────────────────────────────────────────────────────────────
const sections = {
  dashboard:    { title: "Dashboard",    btnText: null },
  ingresos:     { title: "Ingresos",     btnText: "Nuevo Ingreso" },
  gastos:       { title: "Gastos",       btnText: "Nuevo Gasto" },
  presupuesto:  { title: "Presupuesto",  btnText: "Fijar Límite Hoy" },
  tareas:       { title: "Tareas",       btnText: "Nueva Tarea" },
  calendario:   { title: "Calendario",   btnText: "Nuevo Evento" },
  aula:         { title: "Aula Virtual", btnText: "Nuevo Curso" },
  reportes:     { title: "Reportes",     btnText: null },
};

function navigate(sectionKey) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));

  document.getElementById(`section-${sectionKey}`)?.classList.add("active");
  document.querySelector(`.nav-item[data-section="${sectionKey}"]`)?.classList.add("active");

  const meta = sections[sectionKey];
  document.getElementById("pageTitle").textContent = meta.title;

  const btn = document.getElementById("btnPrimaryAction");
  if (meta.btnText) {
    btn.style.display = "inline-flex";
    document.getElementById("btnPrimaryText").textContent = meta.btnText;
  } else {
    btn.style.display = "none";
  }

  loadSection(sectionKey);
}

document.querySelectorAll(".nav-item, [data-section]").forEach(el => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    const sec = el.dataset.section;
    if (sec) navigate(sec);
  });
});

document.getElementById("btnPrimaryAction").addEventListener("click", () => {
  const active = document.querySelector(".nav-item.active")?.dataset.section;
  if (active === "ingresos")    openModalIngreso();
  else if (active === "gastos") openModalGasto();
  else if (active === "tareas") openModalTarea();
  else if (active === "aula")   openModalCurso();
  else if (active === "calendario") {
    if (calTab === "financiero") openModalFinancialDay(todayStr(), null);
    else openModalEvento();
  }
  else if (active === "presupuesto") openModalLimite();
});

// ── Page date ────────────────────────────────────────────────────────────────
document.getElementById("pageDate").textContent = new Date().toLocaleDateString("es-ES", {
  weekday: "long", year: "numeric", month: "long", day: "numeric",
});

// ── Section Loader ────────────────────────────────────────────────────────────
async function loadSection(s) {
  if (s === "dashboard")   loadDashboard();
  if (s === "ingresos")    loadIngresos();
  if (s === "gastos")      loadGastos();
  if (s === "presupuesto") loadPresupuesto();
  if (s === "tareas")      loadTareas();
  if (s === "aula")        loadAula();
  if (s === "reportes")    loadReportes();
  if (s === "calendario")  { switchCalTab(calTab); }
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [resumen, prediccion, hoy, ingresos, gastos, tareas, capital] = await Promise.all([
      apiFetch("/api/presupuesto/resumen"),
      apiFetch("/api/presupuesto/prediccion"),
      apiFetch("/api/presupuesto/hoy"),
      apiFetch("/api/ingresos"),
      apiFetch("/api/gastos"),
      apiFetch("/api/tareas/pendientes"),
      apiFetch("/api/capital"),
    ]);

    // Capital card
    const capEl  = document.getElementById("capitalMonto");
    const dispEl = document.getElementById("capitalDisponible");

    capEl.textContent = fmt(capital.capital);
    capEl.style.color = capital.capital === 0 ? "var(--text-muted)" : "";
    if (capital.capital === 0) capEl.title = "Haz clic en \"Editar capital\" para establecer tu saldo";
    document.getElementById("capitalComprometido").textContent = "-" + fmt(capital.presupuestado);
    dispEl.textContent  = fmt(capital.disponible);
    dispEl.style.color  = capital.disponible >= 0 ? "var(--green)" : "var(--red)";

    document.getElementById("statIngresos").textContent = fmt(resumen.total_ingresos);
    document.getElementById("statGastos").textContent   = fmt(resumen.total_gastos);
    const balance = parseFloat(resumen.balance);
    const balEl = document.getElementById("statBalance");
    if (balEl) {
      balEl.textContent = fmt(balance);
      balEl.style.color = balance >= 0 ? "var(--green)" : "var(--red)";
    }

    // Budget bar
    const gastado = parseFloat(hoy.gastado_hoy);
    const limite  = hoy.limite ? parseFloat(hoy.limite) : null;
    document.getElementById("budgetGastado").textContent = `Gastado: ${fmt(gastado)}`;
    document.getElementById("budgetLimite").textContent  = limite ? `Límite: ${fmt(limite)}` : "Límite: sin definir";

    const fill = document.getElementById("budgetBarFill");
    const statusEl = document.getElementById("budgetStatus");

    if (limite) {
      const pct = Math.min((gastado / limite) * 100, 100);
      fill.style.width = pct + "%";
      if (gastado > limite) {
        fill.className = "budget-bar-fill danger";
        statusEl.textContent = `⚠️ Excediste el límite en ${fmt(gastado - limite)}`;
        statusEl.className = "budget-status danger";
      } else if (pct > 75) {
        statusEl.textContent = `Cuidado: llevas el ${pct.toFixed(0)}% del presupuesto`;
        statusEl.className = "budget-status warning";
        fill.className = "budget-bar-fill";
      } else {
        statusEl.textContent = `✓ Dentro del presupuesto — quedan ${fmt(limite - gastado)}`;
        statusEl.className = "budget-status ok";
        fill.className = "budget-bar-fill";
      }
    } else {
      fill.style.width = "0%";
      statusEl.textContent = "Sin límite definido para hoy";
      statusEl.className = "budget-status";
    }

    // Recent transactions (merge ingresos + gastos, sort by date)
    const all = [
      ...ingresos.map(i => ({ ...i, tipo: "income" })),
      ...gastos.map(g => ({ ...g, tipo: "expense" })),
    ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 8);

    const txList = document.getElementById("recentTransactions");
    if (all.length === 0) {
      txList.innerHTML = `<li class="empty-state">Sin transacciones aún</li>`;
    } else {
      txList.innerHTML = all.map(t => `
        <li class="transaction-item">
          <div class="transaction-left">
            <div class="transaction-dot" style="background:${t.tipo === "income" ? "var(--green)" : "var(--red)"}"></div>
            <div class="transaction-info">
              <span class="transaction-desc">${escHtml(t.descripcion)}</span>
              <span class="transaction-meta">${escHtml(t.categoria)} · ${fmtDate(t.fecha)}</span>
            </div>
          </div>
          <span class="transaction-amount ${t.tipo === "income" ? "income" : "expense"}">
            ${t.tipo === "income" ? "+" : "-"}${fmt(t.monto)}
          </span>
        </li>`).join("");
    }

    // Pending tasks mini
    const taskList = document.getElementById("pendingTasksMini");
    if (tareas.length === 0) {
      taskList.innerHTML = `<li class="empty-state">Sin tareas pendientes 🎉</li>`;
    } else {
      taskList.innerHTML = tareas.slice(0, 6).map(t => `
        <li class="task-mini-item">
          <span class="task-priority-badge badge-${t.prioridad}">${t.prioridad}</span>
          <div class="task-mini-info">
            <div class="task-mini-title">${escHtml(t.titulo)}</div>
            <div class="task-mini-meta">${t.materia ? escHtml(t.materia) + " · " : ""}${t.fecha_entrega ? fmtDate(t.fecha_entrega) : "Sin fecha"}</div>
          </div>
        </li>`).join("");
    }

  } catch (e) {
    showToast("Error cargando dashboard: " + e.message, "error");
    console.error(e);
  }
}

// ── INGRESOS ──────────────────────────────────────────────────────────────────
async function loadIngresos() {
  try {
    const data = await apiFetch("/api/ingresos");
    const tbody = document.getElementById("tbodyIngresos");
    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Sin ingresos registrados</td></tr>`;
      return;
    }
    tbody.innerHTML = data.map(i => `
      <tr>
        <td>${fmtDate(i.fecha)}</td>
        <td>${escHtml(i.descripcion)}</td>
        <td>${escHtml(i.categoria)}</td>
        <td class="amount-income">${fmt(i.monto)}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="deleteIngreso('${i.id}')">Eliminar</button>
        </td>
      </tr>`).join("");
  } catch (e) {
    showToast("Error cargando ingresos", "error");
  }
}

async function deleteIngreso(id) {
  if (!confirm("¿Eliminar este ingreso?")) return;
  try {
    await apiFetch(`/api/ingresos/${id}`, { method: "DELETE" });
    showToast("Ingreso eliminado", "success");
    loadIngresos();
  } catch (e) {
    showToast(e.message, "error");
  }
}

function openModalIngreso() {
  openModal("Nuevo Ingreso", `
    <div class="form-group">
      <label class="form-label">Descripción</label>
      <input class="form-input" id="inDesc" placeholder="Ej: Salario mensual" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Monto ($)</label>
        <input class="form-input" id="inMonto" type="number" min="0" placeholder="0" />
      </div>
      <div class="form-group">
        <label class="form-label">Fecha</label>
        <input class="form-input" id="inFecha" type="date" value="${todayStr()}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Categoría</label>
      <select class="form-input" id="inCat">
        <option>Salario</option><option>Freelance</option><option>Inversión</option>
        <option>Regalo</option><option>Beca</option><option>Otro</option>
      </select>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submitIngreso()">Guardar Ingreso</button>
    </div>`);
}

async function submitIngreso() {
  const body = {
    descripcion: document.getElementById("inDesc").value.trim(),
    monto: parseFloat(document.getElementById("inMonto").value),
    fecha: document.getElementById("inFecha").value,
    categoria: document.getElementById("inCat").value,
  };
  if (!body.descripcion || isNaN(body.monto) || body.monto <= 0) {
    showToast("Completa todos los campos correctamente", "error"); return;
  }
  try {
    await apiFetch("/api/ingresos", { method: "POST", body: JSON.stringify(body) });
    showToast("Ingreso registrado ✓", "success");
    closeModal(); loadIngresos(); loadDashboard();
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ── GASTOS ────────────────────────────────────────────────────────────────────
async function loadGastos() {
  try {
    const data = await apiFetch("/api/gastos");
    const tbody = document.getElementById("tbodyGastos");
    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Sin gastos registrados</td></tr>`;
      return;
    }
    tbody.innerHTML = data.map(g => `
      <tr>
        <td>${fmtDate(g.fecha)}</td>
        <td><span class="cat-badge">${escHtml(g.categoria)}</span></td>
        <td>
          <div class="tx-main">${escHtml(g.motivo || g.descripcion)}</div>
          ${g.motivo && g.descripcion ? `<div class="tx-sub">${escHtml(g.descripcion)}</div>` : ""}
        </td>
        <td class="amount-expense">${fmt(g.monto)}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="deleteGasto('${g.id}')">Eliminar</button>
        </td>
      </tr>`).join("");
  } catch (e) {
    showToast("Error cargando gastos", "error");
  }
}

async function deleteGasto(id) {
  if (!confirm("¿Eliminar este gasto?")) return;
  try {
    await apiFetch(`/api/gastos/${id}`, { method: "DELETE" });
    showToast("Gasto eliminado", "success");
    loadGastos();
  } catch (e) {
    showToast(e.message, "error");
  }
}

function openModalGasto() {
  openModal("Nuevo Gasto", `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Categoría</label>
        <select class="form-input" id="gaCat">
          <option>🍔 Comida</option>
          <option>🎉 Salir / Ocio</option>
          <option>👫 Amigos</option>
          <option>💸 Préstamo</option>
          <option>🚌 Transporte</option>
          <option>📚 Universidad</option>
          <option>🎮 Entretenimiento</option>
          <option>💊 Salud</option>
          <option>🛍 Compras</option>
          <option>💡 Servicios</option>
          <option>🏠 Hogar</option>
          <option>🔧 Otro</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Monto (₡)</label>
        <input class="form-input" id="gaMonto" type="number" min="0" placeholder="0" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">¿En qué gastaste? <span style="color:var(--text-muted);font-weight:400">(motivo principal)</span></label>
      <input class="form-input" id="gaMotivo" placeholder="Ej: Almuerzo con papá, pasaje al cole…" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Fecha</label>
        <input class="form-input" id="gaFecha" type="date" value="${todayStr()}" />
      </div>
      <div class="form-group">
        <label class="form-label">Descripción adicional <span style="color:var(--text-muted);font-weight:400">(opcional)</span></label>
        <input class="form-input" id="gaDesc" placeholder="Notas extra…" />
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submitGasto()">Guardar Gasto</button>
    </div>`);
}

async function submitGasto() {
  const motivo = document.getElementById("gaMotivo").value.trim();
  const body = {
    motivo,
    descripcion: document.getElementById("gaDesc").value.trim(),
    monto: parseFloat(document.getElementById("gaMonto").value),
    fecha: document.getElementById("gaFecha").value,
    categoria: document.getElementById("gaCat").value,
  };
  if (!motivo || isNaN(body.monto) || body.monto <= 0) {
    showToast("Indica el motivo y un monto válido", "error"); return;
  }
  try {
    await apiFetch("/api/gastos", { method: "POST", body: JSON.stringify(body) });
    showToast("Gasto registrado ✓", "success");
    closeModal(); loadGastos(); loadDashboard();
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ── CAPITAL ───────────────────────────────────────────────────────────────────
function openModalCapital() {
  openModal("💳 Actualizar Capital", `
    <p style="font-size:13px;color:var(--text-muted);margin-bottom:14px">
      Este es el dinero total que tienes en tu cuenta. Los gastos se descuentan automáticamente
      y los presupuestos asignados a días futuros quedan marcados como comprometidos.
    </p>
    <div class="form-group">
      <label class="form-label">Capital total (₡)</label>
      <input class="form-input" id="capMonto" type="number" min="0" placeholder="0" />
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submitCapital()">Guardar</button>
    </div>`);
  apiFetch("/api/capital").then(d => {
    const el = document.getElementById("capMonto");
    if (el) el.value = d.capital;
  }).catch(() => {});
}

async function submitCapital() {
  const monto = parseFloat(document.getElementById("capMonto").value);
  if (isNaN(monto) || monto < 0) {
    showToast("Ingresa un monto válido (puede ser 0)", "error"); return;
  }
  try {
    await apiFetch("/api/capital", { method: "PUT", body: JSON.stringify({ monto }) });
    showToast("Capital actualizado ✓", "success");
    closeModal(); loadDashboard();
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ── PRESUPUESTO ───────────────────────────────────────────────────────────────
async function loadPresupuesto() {
  try {
    const [pred, cats] = await Promise.all([
      apiFetch("/api/presupuesto/prediccion"),
      apiFetch("/api/gastos/categorias"),
    ]);

    document.getElementById("statPromedio").textContent      = fmt(pred.promedio_gasto_diario);
    document.getElementById("statDiasRestantes").textContent  = pred.dias_restantes + " días";
    document.getElementById("statGastadoMes").textContent     = fmt(pred.total_gastado);
    const imEl = document.getElementById("statIngresosMes");
    imEl.textContent = fmt(pred.total_ingresado);
    imEl.style.color = parseFloat(pred.total_ingresado) > 0 ? "var(--green)" : "";

    if (cats.length === 0) {
      document.getElementById("categoryBars").innerHTML =
        `<p class="empty-state">Sin gastos este mes</p>`;
      return;
    }

    const max = Math.max(...cats.map(c => parseFloat(c.total)));
    document.getElementById("categoryBars").innerHTML = cats.map(c => {
      const pct = ((parseFloat(c.total) / max) * 100).toFixed(1);
      return `
        <div class="category-bar-item">
          <div class="category-bar-header">
            <span class="category-bar-name">${escHtml(c.categoria)}</span>
            <span class="category-bar-amount">${fmt(c.total)} · ${c.cantidad} registro(s)</span>
          </div>
          <div class="category-bar-track">
            <div class="category-bar-fill" style="width:${pct}%"></div>
          </div>
        </div>`;
    }).join("");
  } catch (e) {
    showToast("Error cargando presupuesto", "error");
  }
}

function openModalLimite() {
  openModal("Establecer Límite Diario", `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Fecha</label>
        <input class="form-input" id="limFecha" type="date" value="${todayStr()}" />
      </div>
      <div class="form-group">
        <label class="form-label">Límite ($)</label>
        <input class="form-input" id="limValor" type="number" min="0" placeholder="50000" />
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submitLimite()">Guardar</button>
    </div>`);
}

async function submitLimite() {
  const body = {
    fecha: document.getElementById("limFecha").value,
    limite: parseFloat(document.getElementById("limValor").value),
  };
  if (isNaN(body.limite) || body.limite <= 0) {
    showToast("Ingresa un límite válido", "error"); return;
  }
  try {
    await apiFetch("/api/presupuesto/limite", { method: "POST", body: JSON.stringify(body) });
    showToast("Límite establecido ✓", "success");
    closeModal(); loadDashboard();
  } catch (e) {
    showToast(e.message, "error");
  }
}

document.getElementById("btnSetLimite").addEventListener("click", openModalLimite);

// ── TAREAS ────────────────────────────────────────────────────────────────────
let draggedTaskId = null;

async function loadTareas() {
  try {
    const data = await apiFetch("/api/tareas");
    const pendientes = data.filter(t => !t.completada);
    const completadas = data.filter(t => t.completada);

    const cols = { alta: [], media: [], baja: [] };
    pendientes.forEach(t => { if (cols[t.prioridad]) cols[t.prioridad].push(t); });

    ["alta", "media", "baja"].forEach(p => {
      const el = document.getElementById(`tasks${p.charAt(0).toUpperCase() + p.slice(1)}`);
      if (cols[p].length === 0) {
        el.innerHTML = `<div class="empty-state" style="padding:16px 0">Sin tareas</div>`;
      } else {
        el.innerHTML = cols[p].map(t => `
          <div class="task-card" id="tc-${t.id}" draggable="true" data-id="${t.id}" data-prioridad="${t.prioridad}">
            <div class="task-card-title">${escHtml(t.titulo)}</div>
            ${t.descripcion ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px">${escHtml(t.descripcion)}</div>` : ""}
            <div class="task-card-meta">
              <div>
                ${t.materia ? `<span class="task-card-materia">${escHtml(t.materia)}</span>` : ""}
                ${t.fecha_entrega ? `<span style="margin-left:6px">📅 ${fmtDate(t.fecha_entrega)}</span>` : ""}
              </div>
              <div class="task-card-actions">
                <button class="btn-complete" onclick="toggleTarea('${t.id}')">✓ Listo</button>
                <button class="btn-del" onclick="deleteTarea('${t.id}')">✕</button>
              </div>
            </div>
          </div>`).join("");
      }
    });

    // Setup drag & drop
    setupDragDrop();

    // Completadas
    const countEl = document.getElementById("completadasCount");
    countEl.textContent = completadas.length > 0 ? `(${completadas.length})` : "";

    const tbody = document.getElementById("tbodyCompletadas");
    if (completadas.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Sin tareas completadas aún</td></tr>`;
    } else {
      tbody.innerHTML = completadas.map(t => `
        <tr>
          <td style="text-decoration:line-through;color:var(--text-muted)">${escHtml(t.titulo)}</td>
          <td>${t.materia ? escHtml(t.materia) : "—"}</td>
          <td><span class="task-priority-badge badge-${t.prioridad}">${t.prioridad}</span></td>
          <td>${t.fecha_entrega ? fmtDate(t.fecha_entrega) : "—"}</td>
          <td style="display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" onclick="toggleTarea('${t.id}')">↩ Reabrir</button>
            <button class="btn btn-danger btn-sm" onclick="deleteTarea('${t.id}')">Eliminar</button>
          </td>
        </tr>`).join("");
    }

  } catch (e) {
    showToast("Error cargando tareas", "error");
  }
}

function setupDragDrop() {
  document.querySelectorAll(".task-card[draggable]").forEach(card => {
    card.addEventListener("dragstart", (e) => {
      draggedTaskId = card.dataset.id;
      setTimeout(() => card.classList.add("dragging"), 0);
      e.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      document.querySelectorAll(".drop-zone").forEach(z => z.classList.remove("drag-over"));
    });
  });

  document.querySelectorAll(".drop-zone").forEach(zone => {
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      zone.classList.add("drag-over");
    });
    zone.addEventListener("dragleave", (e) => {
      if (!zone.contains(e.relatedTarget)) zone.classList.remove("drag-over");
    });
    zone.addEventListener("drop", async (e) => {
      e.preventDefault();
      zone.classList.remove("drag-over");
      const nuevaPrioridad = zone.dataset.prioridad;
      if (!draggedTaskId || !nuevaPrioridad) return;
      try {
        const tarea = await apiFetch(`/api/tareas/${draggedTaskId}`, {});
        // We need to send the full update; fetch current task first then patch priority
        await apiFetch(`/api/tareas/${draggedTaskId}`, {
          method: "PUT",
          body: JSON.stringify({ ...tarea, prioridad: nuevaPrioridad }),
        });
        loadTareas();
      } catch (err) {
        showToast("Error actualizando prioridad", "error");
      }
    });
  });
}

// Toggle completadas section
document.getElementById("completadasToggle").addEventListener("click", () => {
  const body = document.getElementById("completadasBody");
  const chevron = document.getElementById("completadasChevron");
  const open = body.style.display !== "none";
  body.style.display = open ? "none" : "block";
  chevron.textContent = open ? "▼" : "▲";
});

async function toggleTarea(id) {
  try {
    await apiFetch(`/api/tareas/${id}/completar`, { method: "PATCH" });
    loadTareas();
  } catch (e) {
    showToast(e.message, "error");
  }
}

async function deleteTarea(id) {
  if (!confirm("¿Eliminar esta tarea?")) return;
  try {
    await apiFetch(`/api/tareas/${id}`, { method: "DELETE" });
    showToast("Tarea eliminada", "success");
    loadTareas();
  } catch (e) {
    showToast(e.message, "error");
  }
}

function openModalTarea() {
  openModal("Nueva Tarea", `
    <div class="form-group">
      <label class="form-label">Título</label>
      <input class="form-input" id="taTitle" placeholder="Ej: Entregar trabajo de Cálculo" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Materia</label>
        <input class="form-input" id="taMateria" placeholder="Ej: Matemáticas" />
      </div>
      <div class="form-group">
        <label class="form-label">Fecha entrega</label>
        <input class="form-input" id="taFecha" type="date" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Prioridad</label>
      <select class="form-input" id="taPrioridad">
        <option value="alta">🔴 Alta</option>
        <option value="media" selected>🟡 Media</option>
        <option value="baja">🟢 Baja</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Descripción (opcional)</label>
      <textarea class="form-input" id="taDesc" rows="2" placeholder="Detalles..."></textarea>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submitTarea()">Guardar Tarea</button>
    </div>`);
}

async function submitTarea() {
  const body = {
    titulo: document.getElementById("taTitle").value.trim(),
    materia: document.getElementById("taMateria").value.trim() || null,
    fecha_entrega: document.getElementById("taFecha").value || null,
    prioridad: document.getElementById("taPrioridad").value,
    descripcion: document.getElementById("taDesc").value.trim() || null,
  };
  if (!body.titulo) { showToast("El título es requerido", "error"); return; }
  try {
    await apiFetch("/api/tareas", { method: "POST", body: JSON.stringify(body) });
    showToast("Tarea creada ✓", "success");
    closeModal(); loadTareas();
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ── CALENDAR ──────────────────────────────────────────────────────────────────
let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-indexed
let calEvents = [];
let calTab = "financiero"; // "financiero" | "eventos"

// Financial calendar state (shares same year/month)
let finBudgets = [];
let finGastosPorDia = {};

function switchCalTab(tab) {
  calTab = tab;
  document.getElementById("calFinancieroPanel").style.display = tab === "financiero" ? "" : "none";
  document.getElementById("calEventosPanel").style.display    = tab === "eventos"    ? "" : "none";
  document.getElementById("tabFinanciero").classList.toggle("active", tab === "financiero");
  document.getElementById("tabEventos").classList.toggle("active", tab === "eventos");

  // Update top button
  const btnText = document.getElementById("btnPrimaryText");
  btnText.textContent = tab === "financiero" ? "Fijar Límite Día" : "Nuevo Evento";

  if (tab === "financiero") renderFinancialCalendar();
  else renderCalendar();
}

// ── Financial Calendar ────────────────────────────────────────────────────────
async function renderFinancialCalendar() {
  const title = new Date(calYear, calMonth, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  document.getElementById("finCalTitle").textContent = title.charAt(0).toUpperCase() + title.slice(1);

  try {
    const [budgets, gastosMes, capital] = await Promise.all([
      apiFetch(`/api/presupuesto/mes?year=${calYear}&month=${calMonth + 1}`),
      apiFetch(`/api/gastos/mes`),
      apiFetch("/api/capital"),
    ]);
    finBudgets = budgets;

    // Build gastos per day map
    finGastosPorDia = {};
    gastosMes.forEach(g => {
      const d = g.fecha.split("T")[0].split(" ")[0]; // handle both formats
      finGastosPorDia[d] = (finGastosPorDia[d] || 0) + parseFloat(g.monto);
    });

    // Stats
    const totalPresupuestado = budgets.reduce((s, b) => s + parseFloat(b.limite), 0);
    const totalGastado = Object.values(finGastosPorDia).reduce((s, v) => s + v, 0);
    const diferencia = totalPresupuestado - totalGastado;

    document.getElementById("finTotalPresupuesto").textContent = fmt(totalPresupuestado);
    document.getElementById("finTotalGastado").textContent = fmt(totalGastado);
    const difEl = document.getElementById("finDiferencia");
    difEl.textContent = fmt(Math.abs(diferencia));
    difEl.style.color = diferencia >= 0 ? "var(--green)" : "var(--red)";
    difEl.textContent = (diferencia >= 0 ? "+" : "-") + fmt(Math.abs(diferencia));

    // Sobra del capital si se gastan todos los presupuestos del mes
    const capSobraEl = document.getElementById("finCapitalSobra");
    if (capSobraEl) {
      const sobra = capital.capital - totalPresupuestado;
      capSobraEl.textContent = (sobra >= 0 ? "" : "") + fmt(sobra);
      capSobraEl.style.color = sobra >= 0 ? "var(--green)" : "var(--red)";
      const hint = document.getElementById("finCapitalHint");
      if (hint) hint.textContent = `Capital actual: ${fmt(capital.capital)}`;
    }

  } catch {
    finBudgets = [];
    finGastosPorDia = {};
  }

  const grid = document.getElementById("finCalendarGrid");
  grid.innerHTML = "";

  const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  days.forEach(d => {
    const el = document.createElement("div");
    el.className = "cal-day-name";
    el.textContent = d;
    grid.appendChild(el);
  });

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = new Date();

  for (let i = 0; i < firstDay; i++) {
    const cell = document.createElement("div");
    cell.className = "cal-day other-month";
    const prevDays = new Date(calYear, calMonth, 0).getDate();
    cell.innerHTML = `<div class="cal-day-num">${prevDays - firstDay + i + 1}</div>`;
    grid.appendChild(cell);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayOfWeek = new Date(calYear, calMonth, d).getDay(); // 0=Sun, 6=Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const budgetRow = finBudgets.find(b => b.fecha.startsWith(dateStr));
    const gastado   = finGastosPorDia[dateStr] || 0;
    const limite    = budgetRow ? parseFloat(budgetRow.limite) : null;
    const isToday   = today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === d;

    let cls = "cal-day";
    if (isToday) cls += " today";
    if (isWeekend && limite === null) cls += " weekend-rest";
    else if (limite !== null) cls += gastado > limite ? " over-budget" : " has-budget";

    const cell = document.createElement("div");
    cell.className = cls;

    let labels = `<div class="cal-day-num">${d}</div>`;
    if (isWeekend && limite === null) {
      labels += `<div class="cal-budget-label weekend-label">descanso</div>`;
    } else if (limite !== null) {
      labels += `<div class="cal-budget-label">₡${fmtShort(limite)}</div>`;
    }
    if (gastado > 0) {
      const overCls = limite !== null && gastado > limite ? "over" : "spent";
      labels += `<div class="cal-budget-label ${overCls}">-₡${fmtShort(gastado)}</div>`;
    }
    cell.innerHTML = labels;

    cell.addEventListener("click", () => openModalFinancialDay(dateStr, limite, isWeekend));
    grid.appendChild(cell);
  }
}

function fmtShort(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000)    return (n / 1000).toFixed(0) + "k";
  return String(Math.round(n));
}

function openModalFinancialDay(fecha, limiteActual, isWeekend) {
  const dt = new Date(fecha + "T00:00:00");
  const label = dt.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  const gastadoEseDia = finGastosPorDia[fecha] || 0;
  const weekendNote = isWeekend
    ? `<div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:8px;padding:10px 12px;font-size:13px;color:var(--blue);margin-bottom:4px">🌙 Es fin de semana — por defecto no se espera gasto. Puedes dejar en 0 o asignar un monto si planeas salir.</div>`
    : "";
  openModal(`💰 ${label.charAt(0).toUpperCase() + label.slice(1)}`, `
    ${weekendNote}
    <div class="form-group">
      <label class="form-label">Presupuesto planeado para este día (₡) <span style="color:var(--text-muted);font-weight:400">— deja en 0 o vacío para quitar</span></label>
      <input class="form-input" id="finLimValor" type="number" min="0" placeholder="0 = sin presupuesto"
             value="${limiteActual !== null ? limiteActual : (isWeekend ? 0 : "")}" />
    </div>
    ${gastadoEseDia > 0 ? `<p style="font-size:12px;color:var(--text-muted)">Ya gastaste ₡${fmtShort(gastadoEseDia)} este día.</p>` : ""}
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submitFinancialDay('${fecha}')">Guardar</button>
    </div>`);
}

async function submitFinancialDay(fecha) {
  const val = document.getElementById("finLimValor").value;
  const limite = val === "" ? null : parseFloat(val);
  if (limite !== null && isNaN(limite)) { showToast("Ingresa un monto válido", "error"); return; }
  try {
    await apiFetch("/api/presupuesto/limite", { method: "POST", body: JSON.stringify({ fecha, limite: limite ?? 0 }) });
    showToast(limite ? "Presupuesto del día guardado ✓" : "Presupuesto eliminado", "success");
    closeModal();
    renderFinancialCalendar();
  } catch (e) {
    showToast(e.message, "error");
  }
}

document.getElementById("finCalPrev").addEventListener("click", () => {
  calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; }
  if (calTab === "financiero") renderFinancialCalendar(); else renderCalendar();
});
document.getElementById("finCalNext").addEventListener("click", () => {
  calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calTab === "financiero") renderFinancialCalendar(); else renderCalendar();
});

// ── Events Calendar ───────────────────────────────────────────────────────────
async function renderCalendar() {
  const title = new Date(calYear, calMonth, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  document.getElementById("calTitle").textContent = title.charAt(0).toUpperCase() + title.slice(1);

  try {
    calEvents = await apiFetch(`/api/eventos/mes?year=${calYear}&month=${calMonth + 1}`);
  } catch {
    calEvents = [];
  }

  const grid = document.getElementById("calendarGrid");
  grid.innerHTML = "";

  const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  days.forEach(d => {
    const el = document.createElement("div");
    el.className = "cal-day-name";
    el.textContent = d;
    grid.appendChild(el);
  });

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = new Date();

  for (let i = 0; i < firstDay; i++) {
    const cell = document.createElement("div");
    cell.className = "cal-day other-month";
    const prevDays = new Date(calYear, calMonth, 0).getDate();
    cell.innerHTML = `<div class="cal-day-num">${prevDays - firstDay + i + 1}</div>`;
    grid.appendChild(cell);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement("div");
    const isToday = today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === d;
    cell.className = `cal-day${isToday ? " today" : ""}`;

    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayEvents = calEvents.filter(e => e.fecha_inicio.startsWith(dateStr));

    cell.innerHTML = `<div class="cal-day-num">${d}</div>` +
      dayEvents.map(e => `<div class="cal-event-dot" style="background:${e.color || "#f97316"}"></div>`).join("");

    cell.addEventListener("click", () => openModalEventoFecha(dateStr));
    grid.appendChild(cell);
  }

  // Events list
  const list = document.getElementById("eventosList");
  if (calEvents.length === 0) {
    list.innerHTML = `<li class="empty-state">Sin eventos este mes</li>`;
  } else {
    list.innerHTML = calEvents.map(e => `
      <li class="transaction-item">
        <div class="transaction-left">
          <div class="transaction-dot" style="background:${e.color || "var(--orange)"}"></div>
          <div class="transaction-info">
            <span class="transaction-desc">${escHtml(e.titulo)}</span>
            <span class="transaction-meta">${escHtml(e.tipo)} · ${new Date(e.fecha_inicio).toLocaleDateString("es-ES")}</span>
          </div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="deleteEvento('${e.id}')">✕</button>
      </li>`).join("");
  }
}

document.getElementById("calPrev").addEventListener("click", () => {
  calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar();
});
document.getElementById("calNext").addEventListener("click", () => {
  calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar();
});

function openModalEvento() { openModalEventoFecha(todayStr()); }

function openModalEventoFecha(fecha) {
  openModal("Nuevo Evento", `
    <div class="form-group">
      <label class="form-label">Título</label>
      <input class="form-input" id="evTitle" placeholder="Ej: Examen parcial" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Tipo</label>
        <select class="form-input" id="evTipo">
          <option value="general">General</option>
          <option value="financiero">Financiero</option>
          <option value="academico">Académico</option>
          <option value="personal">Personal</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Color</label>
        <input class="form-input" id="evColor" type="color" value="#f97316" style="padding:4px;height:40px" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Fecha inicio</label>
        <input class="form-input" id="evFechaI" type="datetime-local" value="${fecha}T09:00" />
      </div>
      <div class="form-group">
        <label class="form-label">Fecha fin</label>
        <input class="form-input" id="evFechaF" type="datetime-local" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Descripción</label>
      <input class="form-input" id="evDesc" placeholder="Opcional..." />
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submitEvento()">Guardar Evento</button>
    </div>`);
}

async function submitEvento() {
  const body = {
    titulo: document.getElementById("evTitle").value.trim(),
    tipo: document.getElementById("evTipo").value,
    color: document.getElementById("evColor").value,
    fecha_inicio: document.getElementById("evFechaI").value,
    fecha_fin: document.getElementById("evFechaF").value || null,
    descripcion: document.getElementById("evDesc").value.trim() || null,
  };
  if (!body.titulo || !body.fecha_inicio) {
    showToast("Título y fecha son requeridos", "error"); return;
  }
  try {
    await apiFetch("/api/eventos", { method: "POST", body: JSON.stringify(body) });
    showToast("Evento creado ✓", "success");
    closeModal(); renderCalendar();
  } catch (e) {
    showToast(e.message, "error");
  }
}

async function deleteEvento(id) {
  if (!confirm("¿Eliminar este evento?")) return;
  try {
    await apiFetch(`/api/eventos/${id}`, { method: "DELETE" });
    showToast("Evento eliminado", "success");
    renderCalendar();
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ── MODAL UTILS ───────────────────────────────────────────────────────────────
function openModal(title, bodyHtml) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").innerHTML = bodyHtml;
  document.getElementById("modalOverlay").classList.add("open");
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("open");
}

document.getElementById("modalClose").addEventListener("click", closeModal);
document.getElementById("modalOverlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("modalOverlay")) closeModal();
});

// ── UTILS ─────────────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── AULA VIRTUAL ──────────────────────────────────────────────────────────────
let aulaCursos = [];

async function loadAula() {
  try {
    const [cursos, tareas] = await Promise.all([
      apiFetch("/api/cursos"),
      apiFetch("/api/tareas"),
    ]);
    aulaCursos = cursos;
    const container = document.getElementById("aulaContainer");

    if (cursos.length === 0) {
      container.innerHTML = `
        <div class="aula-empty">
          <div style="font-size:48px;margin-bottom:14px">📚</div>
          <p style="font-size:16px;font-weight:600">Sin cursos registrados</p>
          <p style="font-size:13px;color:var(--text-muted)">Haz clic en "Nuevo Curso" para comenzar</p>
        </div>`;
      return;
    }

    container.innerHTML = cursos.map(c => {
      const cursoTareas  = tareas.filter(t => t.materia === c.nombre && !t.completada);
      const completadas  = tareas.filter(t => t.materia === c.nombre && t.completada);
      return `
        <div class="aula-card" style="border-left-color:${c.color || "var(--orange)"}">
          <div class="aula-card-header">
            <div class="aula-title-row">
              <div class="aula-dot" style="background:${c.color || "var(--orange)"}"></div>
              <h3 class="aula-card-name">${escHtml(c.nombre)}</h3>
              ${cursoTareas.length > 0
                ? `<span class="aula-badge">${cursoTareas.length} pendiente${cursoTareas.length !== 1 ? "s" : ""}</span>`
                : ""}
              ${completadas.length > 0
                ? `<span class="aula-badge-done">${completadas.length} lista${completadas.length !== 1 ? "s" : ""}</span>`
                : ""}
            </div>
            <div style="display:flex;gap:6px">
              <button class="btn btn-ghost btn-sm" onclick="openModalTareaAula('${escHtml(c.nombre).replace(/'/g,"&#39;")}', '${c.color || "#3b82f6"}')">+ Tarea</button>
              <button class="btn btn-danger btn-sm" onclick="deleteCurso('${c.id}')">Eliminar</button>
            </div>
          </div>
          ${c.descripcion ? `<p class="aula-desc">${escHtml(c.descripcion)}</p>` : ""}
          <div class="aula-tasks">
            ${cursoTareas.length === 0 && completadas.length === 0
              ? `<p class="aula-no-tasks">Sin tareas aún 🎉</p>`
              : cursoTareas.map(t => `
                  <div class="aula-task-item">
                    <span class="task-priority-badge badge-${t.prioridad}">${t.prioridad}</span>
                    <div class="aula-task-info">
                      <span class="aula-task-title">${escHtml(t.titulo)}</span>
                      ${t.descripcion ? `<span class="aula-task-sub">${escHtml(t.descripcion)}</span>` : ""}
                    </div>
                    ${t.fecha_entrega ? `<span class="aula-task-date">📅 ${fmtDate(t.fecha_entrega)}</span>` : ""}
                    <button class="btn-complete" onclick="toggleTarea('${t.id}'); setTimeout(loadAula, 400)">✓</button>
                  </div>`).join("")
            }
            ${completadas.length > 0 ? `<div class="aula-completadas-row">✅ ${completadas.length} tarea${completadas.length !== 1 ? "s" : ""} completada${completadas.length !== 1 ? "s" : ""}</div>` : ""}
          </div>
        </div>`;
    }).join("");
  } catch (e) {
    showToast("Error cargando aula: " + e.message, "error");
  }
}

function openModalCurso() {
  const colors = ["#f97316","#3b82f6","#22c55e","#a855f7","#ef4444","#eab308","#06b6d4","#ec4899"];
  openModal("📚 Nuevo Curso", `
    <div class="form-group">
      <label class="form-label">Nombre del curso</label>
      <input class="form-input" id="curNombre" placeholder="Ej: Cálculo I, Inglés B2, Programación..." />
    </div>
    <div class="form-group">
      <label class="form-label">Descripción <span style="color:var(--text-muted);font-weight:400">(opcional)</span></label>
      <input class="form-input" id="curDesc" placeholder="Profesor, horario, código del curso..." />
    </div>
    <div class="form-group">
      <label class="form-label">Color del curso</label>
      <div class="color-picker-row" id="colorPickerRow">
        ${colors.map((col, i) =>
          `<button class="color-swatch${i === 0 ? " selected" : ""}" style="background:${col}" data-color="${col}" onclick="selectCursoColor('${col}')"></button>`
        ).join("")}
      </div>
      <input type="hidden" id="curColor" value="${colors[0]}" />
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submitCurso()">Crear Curso</button>
    </div>`);
}

function selectCursoColor(color) {
  document.getElementById("curColor").value = color;
  document.querySelectorAll(".color-swatch").forEach(s => {
    s.classList.toggle("selected", s.dataset.color === color);
  });
}

async function submitCurso() {
  const nombre = document.getElementById("curNombre").value.trim();
  if (!nombre) { showToast("Ingresa el nombre del curso", "error"); return; }
  try {
    await apiFetch("/api/cursos", { method: "POST", body: JSON.stringify({
      nombre,
      descripcion: document.getElementById("curDesc").value.trim(),
      color: document.getElementById("curColor").value,
    })});
    showToast("Curso creado ✓", "success");
    closeModal(); loadAula();
  } catch (e) {
    showToast(e.message, "error");
  }
}

async function deleteCurso(id) {
  if (!confirm("¿Eliminar este curso? Las tareas asociadas NO se borrarán.")) return;
  try {
    await apiFetch(`/api/cursos/${id}`, { method: "DELETE" });
    showToast("Curso eliminado", "success");
    loadAula();
  } catch (e) {
    showToast(e.message, "error");
  }
}

function openModalTareaAula(materia, color) {
  // Store in globals so the submit button can read them without HTML-escaping issues
  window._aulaTareaMateria = materia;
  window._aulaTareaColor   = color || "#3b82f6";
  openModal(`📝 Nueva Tarea — ${escHtml(materia)}`, `
    <div class="form-group">
      <label class="form-label">Título</label>
      <input class="form-input" id="atTitulo" placeholder="Ej: Tarea 3, Ensayo final, Quiz 1..." />
    </div>
    <div class="form-group">
      <label class="form-label">Descripción <span style="color:var(--text-muted);font-weight:400">(opcional)</span></label>
      <input class="form-input" id="atDesc" placeholder="Instrucciones, notas, capítulos..." />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Prioridad</label>
        <select class="form-input" id="atPrioridad">
          <option value="alta">🔴 Alta</option>
          <option value="media" selected>🟡 Media</option>
          <option value="baja">🟢 Baja</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Fecha de entrega</label>
        <input class="form-input" id="atFecha" type="date" />
      </div>
    </div>
    <div class="form-group">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
        <input type="checkbox" id="atAddCalendar" checked style="accent-color:var(--orange);width:16px;height:16px" />
        Agregar al calendario de estudios (si tiene fecha)
      </label>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submitTareaAula()">Guardar Tarea</button>
    </div>`);
}

async function submitTareaAula() {
  const materia = window._aulaTareaMateria || "";
  const color   = window._aulaTareaColor   || "#3b82f6";
  const titulo = document.getElementById("atTitulo").value.trim();
  const fecha  = document.getElementById("atFecha").value;
  if (!titulo) { showToast("Ingresa el título de la tarea", "error"); return; }
  try {
    await apiFetch("/api/tareas", { method: "POST", body: JSON.stringify({
      titulo,
      descripcion: document.getElementById("atDesc").value.trim() || null,
      materia,
      prioridad: document.getElementById("atPrioridad").value,
      fecha_entrega: fecha || null,
    })});
    if (document.getElementById("atAddCalendar").checked && fecha) {
      await apiFetch("/api/eventos", { method: "POST", body: JSON.stringify({
        titulo: `📝 ${titulo} — ${materia}`,
        tipo: "academico",
        color: color,
        fecha_inicio: `${fecha}T08:00`,
        descripcion: `Entrega: ${materia}`,
      })}).catch(() => {});
    }
    showToast("Tarea creada ✓", "success");
    closeModal(); loadAula();
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ── REPORTES ──────────────────────────────────────────────────────────────────
async function loadReportes() {
  try {
    const [resumen, pred, gastos, cats] = await Promise.all([
      apiFetch("/api/presupuesto/resumen"),
      apiFetch("/api/presupuesto/prediccion"),
      apiFetch("/api/gastos"),
      apiFetch("/api/gastos/categorias"),
    ]);

    const totalGastos   = parseFloat(resumen.total_gastos);
    const totalIngresos = parseFloat(resumen.total_ingresos);
    const balance       = parseFloat(resumen.balance);
    const tasa = totalIngresos > 0 ? ((totalIngresos - totalGastos) / totalIngresos * 100) : 0;

    document.getElementById("repIngresos").textContent = fmt(totalIngresos);

    const repGEl = document.getElementById("repGastos");
    repGEl.textContent = fmt(totalGastos);
    repGEl.style.color = totalGastos > 0 ? "var(--red)" : "";

    const repBEl = document.getElementById("repBalance");
    repBEl.textContent = fmt(balance);
    repBEl.style.color = balance >= 0 ? "var(--green)" : "var(--red)";

    const repAEl = document.getElementById("repAhorro");
    repAEl.textContent = tasa.toFixed(1) + "%";
    repAEl.style.color = tasa >= 0 ? "var(--green)" : "var(--red)";

    // Gastos por categoría con porcentaje del total
    const catsEl = document.getElementById("repCategoryBars");
    if (cats.length === 0) {
      catsEl.innerHTML = `<p class="empty-state">Sin gastos este mes</p>`;
    } else {
      const maxVal   = Math.max(...cats.map(c => parseFloat(c.total)));
      const totalCat = cats.reduce((s, c) => s + parseFloat(c.total), 0);
      catsEl.innerHTML = cats.map(c => {
        const pct    = ((parseFloat(c.total) / maxVal)   * 100).toFixed(1);
        const pctTot = ((parseFloat(c.total) / totalCat) * 100).toFixed(1);
        return `
          <div class="category-bar-item">
            <div class="category-bar-header">
              <span class="category-bar-name">${escHtml(c.categoria)}</span>
              <span class="category-bar-amount">${fmt(c.total)} · ${pctTot}%</span>
            </div>
            <div class="category-bar-track">
              <div class="category-bar-fill" style="width:${pct}%"></div>
            </div>
          </div>`;
      }).join("");
    }

    // Top 5 gastos del mes
    const mesMes = new Date().toISOString().slice(0, 7);
    const mesGastos = gastos
      .filter(g => String(g.fecha).startsWith(mesMes))
      .sort((a, b) => parseFloat(b.monto) - parseFloat(a.monto))
      .slice(0, 5);

    const repTopEl = document.getElementById("repTopGastos");
    if (mesGastos.length === 0) {
      repTopEl.innerHTML = `<li class="empty-state">Sin gastos este mes</li>`;
    } else {
      repTopEl.innerHTML = mesGastos.map(g => `
        <li class="transaction-item">
          <div class="transaction-left">
            <div class="transaction-dot" style="background:var(--red)"></div>
            <div class="transaction-info">
              <span class="transaction-desc">${escHtml(g.motivo || g.descripcion || "—")}</span>
              <span class="transaction-meta">${escHtml(g.categoria)} · ${fmtDate(g.fecha)}</span>
            </div>
          </div>
          <span class="transaction-amount expense">-${fmt(g.monto)}</span>
        </li>`).join("");
    }

    // Resumen del período
    const totalRegistros = gastos.filter(g => String(g.fecha).startsWith(mesMes)).length;
    document.getElementById("repDistribucion").innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px">
        <div style="background:var(--bg-card-2);border-radius:10px;padding:16px">
          <p style="color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:0.08em">Promedio Diario</p>
          <p style="font-size:22px;font-weight:700;color:var(--orange);margin-top:6px">${fmt(pred.promedio_gasto_diario)}</p>
        </div>
        <div style="background:var(--bg-card-2);border-radius:10px;padding:16px">
          <p style="color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:0.08em">Días Transcurridos</p>
          <p style="font-size:22px;font-weight:700;color:var(--blue);margin-top:6px">${pred.dias_transcurridos}</p>
        </div>
        <div style="background:var(--bg-card-2);border-radius:10px;padding:16px">
          <p style="color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:0.08em">Días Restantes del Mes</p>
          <p style="font-size:22px;font-weight:700;color:var(--text);margin-top:6px">${pred.dias_restantes}</p>
        </div>
        <div style="background:var(--bg-card-2);border-radius:10px;padding:16px">
          <p style="color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:0.08em">Registros este Mes</p>
          <p style="font-size:22px;font-weight:700;color:var(--green);margin-top:6px">${totalRegistros}</p>
        </div>
        <div style="background:var(--bg-card-2);border-radius:10px;padding:16px">
          <p style="color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:0.08em">Proyección Fin de Mes</p>
          <p style="font-size:22px;font-weight:700;color:${parseFloat(pred.prediccion_balance) >= 0 ? "var(--green)" : "var(--red)"};margin-top:6px">${fmt(pred.prediccion_balance)}</p>
        </div>
        <div style="background:var(--bg-card-2);border-radius:10px;padding:16px">
          <p style="color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:0.08em">Gasto Total Proyectado</p>
          <p style="font-size:22px;font-weight:700;color:var(--red);margin-top:6px">${fmt(pred.prediccion_gasto_final)}</p>
        </div>
      </div>`;
  } catch (e) {
    showToast("Error cargando reportes", "error");
    console.error(e);
  }
}

// ── INIT ──────────────────────────────────────────────────────────────────────
navigate("dashboard");
