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

// ── Mobile Sidebar ────────────────────────────────────────────────────────────
const _sidebar   = document.getElementById("sidebar");
const _backdrop  = document.getElementById("sidebarBackdrop");
const _menuBtn   = document.getElementById("mobileMenuBtn");

function openMobileSidebar() {
  _sidebar.classList.add("open");
  _backdrop.classList.add("active");
  document.body.style.overflow = "hidden";
}
function closeMobileSidebar() {
  _sidebar.classList.remove("open");
  _backdrop.classList.remove("active");
  document.body.style.overflow = "";
}

_menuBtn.addEventListener("click", () => {
  _sidebar.classList.contains("open") ? closeMobileSidebar() : openMobileSidebar();
});
_backdrop.addEventListener("click", closeMobileSidebar);

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
    if (sec) {
      navigate(sec);
      closeMobileSidebar(); // cierra en móvil al seleccionar sección
    }
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
    const [eventsData, tareasData] = await Promise.all([
      apiFetch(`/api/eventos/mes?year=${calYear}&month=${calMonth + 1}`),
      apiFetch("/api/tareas"),
    ]);
    calEvents = eventsData;

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
      const dayTareas = tareasData.filter(t => t.fecha_entrega && t.fecha_entrega.startsWith(dateStr) && !t.completada);

      cell.innerHTML = `<div class="cal-day-num">${d}</div>` +
        dayEvents.map(e => `<div class="cal-event-dot" style="background:${e.color || "#f97316"}" title="${escHtml(e.titulo)}"></div>`).join("") +
        (dayTareas.length > 0 ? `<div class="cal-task-dot" title="${dayTareas.length} tarea${dayTareas.length !== 1 ? "s" : ""}">📋</div>` : "");

      cell.addEventListener("click", () => openDayModal(dateStr, dayEvents, dayTareas));
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
  } catch (err) {
    calEvents = [];
    console.error("Error renderCalendar:", err);
  }
}

document.getElementById("calPrev").addEventListener("click", () => {
  calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar();
});
document.getElementById("calNext").addEventListener("click", () => {
  calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar();
});

function openModalEvento() { openModalEventoFecha(todayStr()); }

// ── Calendar Day Modal ────────────────────────────────────────────────────────
function openDayModal(dateStr, dayEvents, dayTareas) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const label = new Date(year, month - 1, day).toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const labelCap = label.charAt(0).toUpperCase() + label.slice(1);

  const eventsHtml = dayEvents.length === 0
    ? `<p class="aula-no-tasks">Sin eventos</p>`
    : dayEvents.map(e => `
        <div class="day-event-item">
          <span class="day-ev-dot" style="background:${e.color || "var(--orange)"}"></span>
          <span class="day-ev-title">${escHtml(e.titulo)}</span>
          <span class="day-ev-type">${escHtml(e.tipo)}</span>
        </div>`).join("");

  const tareasHtml = dayTareas.length === 0
    ? `<p class="aula-no-tasks">Sin tareas para este día 🎉</p>`
    : dayTareas.map(t => {
        const cursoColor = (aulaCursos.find(c => c.nombre === t.materia) || {}).color || "var(--orange)";
        return `
          <div class="day-task-item">
            <span class="day-ev-dot" style="background:${cursoColor}"></span>
            <div class="day-task-info">
              <span class="day-task-title">${escHtml(t.titulo)}</span>
              <span class="day-task-meta">${escHtml(t.materia || "—")} · <span class="task-priority-badge badge-${t.prioridad}">${t.prioridad}</span></span>
            </div>
            <button class="btn-complete" onclick="toggleTarea('${t.id}'); closeModal(); showToast('Tarea completada ✓','success')" title="Marcar completada">✓</button>
          </div>`;
      }).join("");

  const cursoOptions = aulaCursos.length > 0
    ? aulaCursos.map(c => `<option value="${escHtml(c.nombre)}" data-color="${c.color || "#f97316"}">${escHtml(c.nombre)}</option>`).join("")
    : `<option value="">Sin cursos registrados</option>`;

  openModal(`📅 ${labelCap}`, `
    <div class="day-modal-section">
      <div class="day-modal-section-title">📋 Tareas pendientes</div>
      ${tareasHtml}
    </div>
    <div class="day-modal-section">
      <div class="day-modal-section-title">📌 Eventos</div>
      ${eventsHtml}
    </div>
    <div class="day-modal-divider"></div>
    <div class="form-row" style="gap:8px">
      <button class="btn btn-primary" style="flex:1" onclick="openTareaDesdeCalendario('${dateStr}')">+ Nueva Tarea</button>
      <button class="btn btn-ghost" style="flex:1" onclick="openModalEventoFecha('${dateStr}')">+ Nuevo Evento</button>
    </div>`);
}

function openTareaDesdeCalendario(dateStr) {
  const cursoOptions = aulaCursos.length > 0
    ? aulaCursos.map(c => `<option value="${escHtml(c.nombre)}" data-color="${c.color || "#f97316"}">${escHtml(c.nombre)}</option>`).join("")
    : `<option value="">Sin cursos — crea uno primero</option>`;

  openModal("📝 Nueva Tarea desde Calendario", `
    <div class="form-group">
      <label class="form-label">Curso</label>
      <select class="form-input" id="calTareaCurso" ${aulaCursos.length === 0 ? "disabled" : ""}>
        ${cursoOptions}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Título</label>
      <input class="form-input" id="calTareaTitulo" placeholder="Ej: Tarea 3, Ensayo, Quiz 1..." />
    </div>
    <div class="form-group">
      <label class="form-label">Descripción <span style="color:var(--text-muted);font-weight:400">(opcional)</span></label>
      <input class="form-input" id="calTareaDesc" placeholder="Instrucciones, notas..." />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Prioridad</label>
        <select class="form-input" id="calTareaPrioridad">
          <option value="alta">🔴 Alta</option>
          <option value="media" selected>🟡 Media</option>
          <option value="baja">🟢 Baja</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Fecha de entrega</label>
        <input class="form-input" id="calTareaFecha" type="date" value="${dateStr}" />
      </div>
    </div>
    <div class="form-group">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
        <input type="checkbox" id="calTareaAddCal" checked style="accent-color:var(--orange);width:16px;height:16px" />
        Agregar evento al calendario
      </label>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submitTareaDesdeCalendario()">Guardar Tarea</button>
    </div>`);
}

async function submitTareaDesdeCalendario() {
  const titulo = document.getElementById("calTareaTitulo").value.trim();
  if (!titulo) { showToast("Ingresa el título de la tarea", "error"); return; }
  const sel = document.getElementById("calTareaCurso");
  const materia = sel.value;
  const cursoColor = (aulaCursos.find(c => c.nombre === materia) || {}).color || "#f97316";
  const fecha = document.getElementById("calTareaFecha").value;
  try {
    await apiFetch("/api/tareas", { method: "POST", body: JSON.stringify({
      titulo,
      descripcion: document.getElementById("calTareaDesc").value.trim() || null,
      materia,
      prioridad: document.getElementById("calTareaPrioridad").value,
      fecha_entrega: fecha || null,
    })});
    if (document.getElementById("calTareaAddCal").checked && fecha) {
      await apiFetch("/api/eventos", { method: "POST", body: JSON.stringify({
        titulo: `📝 ${titulo} — ${materia}`,
        tipo: "academico",
        color: cursoColor,
        fecha_inicio: `${fecha}T08:00`,
        descripcion: `Entrega: ${materia}`,
      })}).catch(() => {});
    }
    showToast("Tarea creada ✓", "success");
    closeModal(); renderCalendar();
  } catch (e) {
    showToast(e.message, "error");
  }
}

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
    const [cursos, tareas, evaluaciones] = await Promise.all([
      apiFetch("/api/cursos"),
      apiFetch("/api/tareas"),
      apiFetch("/api/cursos/all-evaluaciones"),
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

    // Group evaluaciones by curso_id
    const evalsByCurso = {};
    evaluaciones.forEach(e => {
      if (!evalsByCurso[e.curso_id]) evalsByCurso[e.curso_id] = [];
      evalsByCurso[e.curso_id].push(e);
    });

    container.innerHTML = cursos.map(c => {
      const color       = c.color || "#f97316";
      const initial     = c.nombre.charAt(0).toUpperCase();
      const pending     = tareas.filter(t => t.materia === c.nombre && !t.completada);
      const done        = tareas.filter(t => t.materia === c.nombre && t.completada);
      const evals       = evalsByCurso[c.id] || [];

      // Accumulated score calculation
      const acum = evals.reduce((sum, ev) => {
        return ev.nota != null ? sum + (parseFloat(ev.nota) * parseFloat(ev.peso) / 100) : sum;
      }, 0);
      const totalPeso = evals.reduce((sum, ev) => sum + parseFloat(ev.peso), 0);
      const pctBar    = Math.min(100, totalPeso > 0 ? (acum / totalPeso) * 100 : 0);

      // Safe id for use in onclick attrs — cursos use integer IDs so safe
      const cid = c.id;
      const cnameEsc = escHtml(c.nombre).replace(/'/g, "&#39;");
      const colorSafe = color.replace(/'/g, "");

      return `
        <div class="curso-card">
          <div class="curso-card-header" style="background:linear-gradient(135deg,${color}cc 0%,${color}66 100%)">
            <div class="curso-header-content">
              <span class="curso-header-initial" style="color:${color}">${initial}</span>
              <div>
                <h3 class="curso-header-name">${escHtml(c.nombre)}</h3>
                ${c.descripcion ? `<p class="curso-header-desc">${escHtml(c.descripcion)}</p>` : ""}
              </div>
            </div>
            <div class="curso-header-badges">
              ${pending.length > 0 ? `<span class="aula-badge">${pending.length} tarea${pending.length !== 1 ? "s" : ""}</span>` : ""}
              ${evals.length > 0 ? `<span class="eval-acum-badge" style="background:${color}33;color:${color};border-color:${color}55">${acum.toFixed(1)}pts</span>` : ""}
            </div>
          </div>

          <div class="curso-card-body">

            <!-- TAREAS -->
            <div class="curso-section">
              <div class="curso-section-header">
                <span class="curso-section-title">📋 Tareas</span>
                <button class="btn btn-ghost btn-sm" onclick="openModalTareaAula('${cnameEsc}','${colorSafe}')">+ Tarea</button>
              </div>
              <div class="aula-tasks">
                ${pending.length === 0 && done.length === 0
                  ? `<p class="aula-no-tasks">Sin tareas aún 🎉</p>`
                  : pending.map(t => `
                      <div class="aula-task-item">
                        <span class="task-priority-badge badge-${t.prioridad}">${t.prioridad}</span>
                        <div class="aula-task-info">
                          <span class="aula-task-title">${escHtml(t.titulo)}</span>
                          ${t.descripcion ? `<span class="aula-task-sub">${escHtml(t.descripcion)}</span>` : ""}
                        </div>
                        ${t.fecha_entrega ? `<span class="aula-task-date">📅 ${fmtDate(t.fecha_entrega)}</span>` : ""}
                        <button class="btn-complete" onclick="toggleTarea('${t.id}'); setTimeout(loadAula, 400)" title="Marcar completada">✓</button>
                      </div>`).join("")
                }
                ${done.length > 0 ? `<div class="aula-completadas-row">✅ ${done.length} completada${done.length !== 1 ? "s" : ""}</div>` : ""}
              </div>
            </div>

            <!-- CALIFICACIONES -->
            <div class="curso-section">
              <div class="curso-section-header">
                <span class="curso-section-title">📊 Calificaciones</span>
                <button class="btn btn-ghost btn-sm" onclick="openModalEvaluacion(${cid},'${cnameEsc}')">+ Evaluación</button>
              </div>
              ${evals.length > 0 ? `
              <div class="eval-progress-wrap">
                <div class="eval-progress-track">
                  <div class="eval-progress-fill" style="width:${pctBar.toFixed(1)}%;background:${color}"></div>
                </div>
                <span class="eval-progress-label">Acumulado: <strong>${acum.toFixed(1)}</strong> / ${totalPeso.toFixed(0)} pts posibles</span>
              </div>` : ""}
              <div class="eval-list">
                ${evals.length === 0
                  ? `<p class="aula-no-tasks">Sin evaluaciones registradas</p>`
                  : evals.map(ev => {
                      const pts = ev.nota != null ? (parseFloat(ev.nota) * parseFloat(ev.peso) / 100).toFixed(2) : null;
                      return `
                        <div class="eval-row">
                          <div class="eval-row-info">
                            <span class="eval-nombre">${escHtml(ev.nombre)}</span>
                            <div class="eval-peso-row">
                              <input type="number" class="eval-inline-input" value="${parseFloat(ev.peso)}"
                                min="0" max="100" step="0.5"
                                onchange="savePesoInline(${ev.id}, this.value)"
                                title="Editar porcentaje" />
                              <span class="eval-peso-label">% del total</span>
                            </div>
                          </div>
                          <div class="eval-row-score">
                            <input type="number" class="eval-nota-input" value="${ev.nota != null ? parseFloat(ev.nota) : ''}"
                              min="0" max="100" step="0.1" placeholder="—"
                              onchange="saveNotaInline(${ev.id}, this.value)"
                              title="Nota (0–100)" />
                            ${ev.nota != null ? `<span class="eval-pts">${pts}pts</span>` : ''}
                          </div>
                          <button class="eval-del-btn" onclick="deleteEvaluacion(${ev.id},${cid})" title="Eliminar">✕</button>
                        </div>`;
                    }).join("")
                }
              </div>
            </div>

            <div class="curso-card-footer">
              <button class="btn btn-ghost btn-sm" onclick="openEditCurso(${cid},'${cnameEsc}','${escHtml(c.descripcion || "").replace(/'/g,"&#39;")}','${colorSafe}')">✏ Editar</button>
              <button class="btn btn-danger btn-sm" onclick="deleteCurso(${cid})">Eliminar</button>
            </div>
          </div>
        </div>`;
    }).join("");
  } catch (e) {
    showToast("Error cargando aula: " + e.message, "error");
  }
}

function openModalCurso(initialColor) {
  const colors = ["#f97316","#3b82f6","#22c55e","#a855f7","#ef4444","#eab308","#06b6d4","#ec4899"];
  const sel = initialColor || colors[0];
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
        ${colors.map(col =>
          `<button class="color-swatch${col === sel ? " selected" : ""}" style="background:${col}" data-color="${col}" onclick="selectCursoColor('${col}')"></button>`
        ).join("")}
      </div>
      <input type="hidden" id="curColor" value="${sel}" />
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

function openEditCurso(id, nombre, desc, color) {
  const colors = ["#f97316","#3b82f6","#22c55e","#a855f7","#ef4444","#eab308","#06b6d4","#ec4899"];
  openModal("✏ Editar Curso", `
    <div class="form-group">
      <label class="form-label">Nombre del curso</label>
      <input class="form-input" id="editCurNombre" value="${escHtml(nombre)}" />
    </div>
    <div class="form-group">
      <label class="form-label">Descripción</label>
      <input class="form-input" id="editCurDesc" value="${escHtml(desc)}" placeholder="Profesor, horario..." />
    </div>
    <div class="form-group">
      <label class="form-label">Color del curso</label>
      <div class="color-picker-row" id="colorPickerRow">
        ${colors.map(col =>
          `<button class="color-swatch${col === color ? " selected" : ""}" style="background:${col}" data-color="${col}" onclick="selectCursoColor('${col}')"></button>`
        ).join("")}
      </div>
      <input type="hidden" id="curColor" value="${color}" />
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submitEditCurso(${id})">Guardar Cambios</button>
    </div>`);
}

async function submitEditCurso(id) {
  const nombre = document.getElementById("editCurNombre").value.trim();
  if (!nombre) { showToast("Ingresa el nombre del curso", "error"); return; }
  try {
    await apiFetch(`/api/cursos/${id}`, { method: "PUT", body: JSON.stringify({
      nombre,
      descripcion: document.getElementById("editCurDesc").value.trim(),
      color: document.getElementById("curColor").value,
    })});
    showToast("Curso actualizado ✓", "success");
    closeModal(); loadAula();
  } catch (e) {
    showToast(e.message, "error");
  }
}

function deleteCurso(id) {
  openConfirm("¿Eliminar este curso? Las evaluaciones se borrarán. Las tareas asociadas NO se eliminarán.", async () => {
    try {
      await apiFetch(`/api/cursos/${id}`, { method: "DELETE" });
      showToast("Curso eliminado", "success");
      loadAula();
    } catch (e) {
      showToast(e.message, "error");
    }
  });
}

function openModalTareaAula(materia, color, fechaPreset) {
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
        <input class="form-input" id="atFecha" type="date" value="${fechaPreset || ""}" />
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

// ── EVALUACIONES (Calificaciones) ─────────────────────────────────────────────
function openModalEvaluacion(cursoId, cursoNombre) {
  openModal(`📊 Nueva Evaluación — ${escHtml(cursoNombre)}`, `
    <p style="color:var(--text-muted);font-size:13px;margin-bottom:16px">
      Define el nombre y el peso (%) que tiene esta evaluación sobre la nota final del curso.
    </p>
    <div class="form-group">
      <label class="form-label">Nombre de la evaluación</label>
      <input class="form-input" id="evNombre" placeholder="Ej: Parcial 1, Quiz 2, Proyecto, Examen Final..." />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Peso sobre la nota final (%)</label>
        <input class="form-input" id="evPeso" type="number" min="0" max="100" step="0.5" placeholder="Ej: 30" />
      </div>
      <div class="form-group">
        <label class="form-label">Nota obtenida <span style="color:var(--text-muted);font-weight:400">(opcional)</span></label>
        <input class="form-input" id="evNota" type="number" min="0" max="100" step="0.1" placeholder="0 – 100" />
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submitEvaluacion(${cursoId})">Guardar</button>
    </div>`);
}

async function submitEvaluacion(cursoId) {
  const nombre = document.getElementById("evNombre").value.trim();
  const peso   = document.getElementById("evPeso").value;
  const nota   = document.getElementById("evNota").value;
  if (!nombre) { showToast("Ingresa el nombre de la evaluación", "error"); return; }
  if (!peso || isNaN(parseFloat(peso))) { showToast("Ingresa el peso (%)", "error"); return; }
  try {
    const newEval = await apiFetch(`/api/cursos/${cursoId}/evaluaciones`, {
      method: "POST",
      body: JSON.stringify({ nombre, peso: parseFloat(peso) }),
    });
    // If nota was provided, update it immediately
    if (nota !== "" && !isNaN(parseFloat(nota))) {
      await apiFetch(`/api/cursos/evaluaciones/${newEval.id}`, {
        method: "PUT",
        body: JSON.stringify({ nota: parseFloat(nota) }),
      });
    }
    showToast("Evaluación registrada ✓", "success");
    closeModal(); loadAula();
  } catch (e) {
    showToast(e.message, "error");
  }
}

function openSetNota(evalId, cursoId, cursoNombre, evalNombre) {
  openModal(`✏ Registrar Nota — ${escHtml(evalNombre)}`, `
    <p style="color:var(--text-muted);font-size:13px;margin-bottom:16px">
      Curso: <strong>${escHtml(cursoNombre)}</strong>
    </p>
    <div class="form-group">
      <label class="form-label">Nota obtenida (0 – 100)</label>
      <input class="form-input" id="setNotaVal" type="number" min="0" max="100" step="0.1" placeholder="Ej: 85" autofocus />
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submitSetNota(${evalId},${cursoId})">Guardar Nota</button>
    </div>`);
}

async function submitSetNota(evalId, cursoId) {
  const val = document.getElementById("setNotaVal").value;
  if (val === "" || isNaN(parseFloat(val))) { showToast("Ingresa una nota válida (0–100)", "error"); return; }
  try {
    await apiFetch(`/api/cursos/evaluaciones/${evalId}`, {
      method: "PUT",
      body: JSON.stringify({ nota: parseFloat(val) }),
    });
    showToast("Nota registrada ✓", "success");
    closeModal(); loadAula();
  } catch (e) {
    showToast(e.message, "error");
  }
}

function deleteEvaluacion(evalId, cursoId) {
  openConfirm("¿Eliminar esta evaluación?", async () => {
    try {
      await apiFetch(`/api/cursos/evaluaciones/${evalId}`, { method: "DELETE" });
      showToast("Evaluación eliminada", "success");
      loadAula();
    } catch (e) {
      showToast(e.message, "error");
    }
  });
}

// ── IA AUTO-DETECT ────────────────────────────────────────────────────────────
let _iaFiles    = [];
let _iaResultado = null;

function openIAModal() {
  _iaFiles    = [];
  _iaResultado = null;
  const savedKey = localStorage.getItem("groq_api_key") || "";
  openModal("🤖 Auto-detectar con Inteligencia Artificial", `
    <div style="margin-bottom:14px">
      <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:5px">🔑 Clave de API de Groq (se guarda en tu navegador)</label>
      <div style="display:flex;gap:8px;align-items:center">
        <input id="iaKeyInput" type="password" value="${escHtml(savedKey)}"
          placeholder="gsk_..."
          style="flex:1;padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg-card-2);color:var(--text);font-size:13px"
          oninput="_iaSaveKey(this.value)" />
        <a href="https://console.groq.com/keys" target="_blank"
          style="font-size:11px;color:var(--orange);white-space:nowrap;text-decoration:none">Obtener gratis →</a>
      </div>
    </div>
    <p style="color:var(--text-muted);font-size:13px;margin-bottom:16px">
      Sube fotos de tu Moodle, horario, silabo, WhatsApp con tareas, o cualquier documento académico.<br>
      La IA extrae los cursos y tareas automáticamente.
    </p>
    <div class="ia-drop-zone" id="iaDropZone" onclick="document.getElementById('iaFileInput').click()">
      <div style="font-size:42px;margin-bottom:10px">�</div>
      <p style="font-weight:600;font-size:15px;color:var(--text)">Arrastra archivos aquí</p>
      <p style="font-size:12px;color:var(--text-muted);margin-top:5px">o toca para seleccionar&nbsp;·&nbsp;Hasta 5 archivos&nbsp;·&nbsp;JPG PNG WEBP PDF DOCX</p>
      <input type="file" id="iaFileInput" accept="image/*,.pdf,.doc,.docx" multiple style="display:none" onchange="iaAgregarArchivos(this.files)" />
    </div>
    <div id="iaThumbs" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px"></div>
    <div id="iaMsg" style="margin-top:6px;font-size:13px;color:var(--text-muted)"></div>
    <div class="form-actions" style="margin-top:18px">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="iaBtnAnalizar" disabled onclick="iaAnalizar()">
        🤖 Analizar con IA
      </button>
    </div>`);

  // Drag & Drop
  setTimeout(() => {
    const zone = document.getElementById("iaDropZone");
    if (!zone) return;
    zone.addEventListener("dragover", e => {
      e.preventDefault();
      zone.classList.add("drag-over");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
    zone.addEventListener("drop", e => {
      e.preventDefault();
      zone.classList.remove("drag-over");
      iaAgregarArchivos(e.dataTransfer.files);
    });
  }, 80);
}

function _iaSaveKey(val) {
  if (val.trim()) localStorage.setItem("groq_api_key", val.trim());
  else localStorage.removeItem("groq_api_key");
}

function iaAgregarArchivos(fileList) {
  const allowed = f =>
    f.type.startsWith("image/") ||
    f.type === "application/pdf" ||
    f.type === "application/msword" ||
    f.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  for (const f of fileList) {
    if (_iaFiles.length >= 5) { showToast("Máximo 5 archivos", "error"); break; }
    if (!allowed(f)) { showToast("Solo se aceptan imágenes, PDF o Word", "error"); continue; }
    _iaFiles.push(f);
  }
  _iaRenderThumbs();
}

function iaRemoverArchivo(idx) {
  _iaFiles.splice(idx, 1);
  _iaRenderThumbs();
}

function _iaRenderThumbs() {
  const thumbs = document.getElementById("iaThumbs");
  const btn    = document.getElementById("iaBtnAnalizar");
  const msg    = document.getElementById("iaMsg");
  if (!thumbs) return;

  thumbs.innerHTML = _iaFiles.map((f, i) => {
    const isImg  = f.type.startsWith("image/");
    const icon   = f.type === "application/pdf" ? "📄" : "📝";
    const preview = isImg
      ? `<img src="${URL.createObjectURL(f)}" style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:2px solid var(--border)" />`
      : `<div style="width:72px;height:72px;border-radius:8px;border:2px solid var(--border);background:var(--bg-card-2);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:4px;text-align:center">
           <span style="font-size:26px">${icon}</span>
           <span style="font-size:9px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:62px">${escHtml(f.name)}</span>
         </div>`;
    return `<div style="position:relative">
      ${preview}
      <button onclick="iaRemoverArchivo(${i})"
        style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;
               background:var(--red);color:#fff;font-size:10px;display:flex;align-items:center;
               justify-content:center;border:none;cursor:pointer">✕</button>
    </div>`;
  }).join("");

  if (_iaFiles.length > 0) {
    btn.disabled = false;
    msg.textContent = `${_iaFiles.length} archivo${_iaFiles.length !== 1 ? "s" : ""} listo${_iaFiles.length !== 1 ? "s" : ""} para analizar`;
  } else {
    btn.disabled = true;
    msg.textContent = "";
  }
}

async function iaAnalizar() {
  if (_iaFiles.length === 0) return;

  const body = document.getElementById("modalBody");
  body.innerHTML = `
    <div style="text-align:center;padding:50px 20px">
      <div class="ia-spinner"></div>
      <p style="margin-top:18px;font-weight:600;font-size:16px">Analizando con IA...</p>
      <p style="font-size:13px;color:var(--text-muted);margin-top:6px">Esto puede tomar 10–20 segundos</p>
    </div>`;

  try {
    const apiKey = (document.getElementById("iaKeyInput")?.value || localStorage.getItem("groq_api_key") || "").trim();
    const fd = new FormData();
    _iaFiles.forEach(f => fd.append("archivos", f));

    const res  = await fetch("/api/ia/analizar", { method: "POST", body: fd, headers: { "x-groq-key": apiKey } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error desconocido");

    _iaResultado = data;
    _iaMostrarPreview(data);
  } catch (e) {
    const body2 = document.getElementById("modalBody");
    if (!body2) return;
    body2.innerHTML = `
      <div style="text-align:center;padding:36px 20px">
        <div style="font-size:44px;margin-bottom:14px">⚠️</div>
        <p style="font-weight:600;color:var(--red);font-size:15px">${escHtml(e.message)}</p>
        ${e.message.includes("GEMINI_API_KEY") ? `
        <div class="ia-key-hint">
          <p style="font-weight:600;margin-bottom:8px">Cómo obtener la clave GRATIS (≠2 min)</p>
          <ol style="text-align:left;font-size:12px;line-height:1.9;padding-left:18px">
            <li>Entrá a <strong>aistudio.google.com/app/apikey</strong></li>
            <li>Clic en <strong>"Create API Key"</strong></li>
            <li>Copiá la clave</li>
            <li>En Railway → Finora → <strong>Variables</strong> → agrega:<br/><code style="background:var(--bg-card-2);padding:2px 6px;border-radius:4px">GEMINI_API_KEY</code> = tu clave</li>
          </ol>
        </div>` : ""}
        <div class="form-actions" style="margin-top:20px;justify-content:center">
          <button class="btn btn-ghost" onclick="closeModal()">Cerrar</button>
          <button class="btn btn-primary" onclick="openIAModal()">Intentar de nuevo</button>
        </div>
      </div>`;
  }
}

function _iaMostrarPreview({ cursos, tareas }) {
  const body = document.getElementById("modalBody");
  document.getElementById("modalTitle").textContent = "🤖 Revisá lo que detectó la IA";

  if (cursos.length === 0 && tareas.length === 0) {
    body.innerHTML = `
      <div style="text-align:center;padding:36px 20px">
        <div style="font-size:44px;margin-bottom:14px">🤔</div>
        <p style="font-weight:600;font-size:15px">No se detectó información académica</p>
        <p style="font-size:13px;color:var(--text-muted);margin-top:8px">
          Intentá con una imagen más clara, con más texto visible, o con una captura del Moodle
        </p>
        <div class="form-actions" style="margin-top:20px;justify-content:center">
          <button class="btn btn-ghost" onclick="closeModal()">Cerrar</button>
          <button class="btn btn-primary" onclick="openIAModal()">Nueva imagen</button>
        </div>
      </div>`;
    return;
  }

  const existingNames = new Set(aulaCursos.map(c => c.nombre.toLowerCase()));

  const cursosHtml = cursos.length === 0
    ? `<p class="aula-no-tasks">No se detectaron cursos nuevos</p>`
    : cursos.map((c, i) => {
        const isDup = existingNames.has(c.nombre.toLowerCase());
        return `
          <label class="ia-preview-row${isDup ? " ia-dup" : ""}">
            <input type="checkbox" class="ia-check-curso" data-idx="${i}"
              ${isDup ? "" : "checked"}
              style="accent-color:var(--orange);width:15px;height:15px;flex-shrink:0;cursor:pointer" />
            <span class="ia-color-dot" style="background:${c.color || "var(--orange)"}"></span>
            <div class="ia-preview-info">
              <span class="ia-preview-name">${escHtml(c.nombre)}</span>
              ${c.descripcion ? `<span class="ia-preview-sub">${escHtml(c.descripcion)}</span>` : ""}
            </div>
            ${isDup ? `<span class="ia-dup-badge">ya existe</span>` : ""}
          </label>`;
      }).join("");

  const tareasHtml = tareas.length === 0
    ? `<p class="aula-no-tasks">No se detectaron tareas</p>`
    : tareas.map((t, i) => `
        <label class="ia-preview-row">
          <input type="checkbox" class="ia-check-tarea" data-idx="${i}" checked
            style="accent-color:var(--orange);width:15px;height:15px;flex-shrink:0;cursor:pointer" />
          <span class="task-priority-badge badge-${t.prioridad}">${t.prioridad}</span>
          <div class="ia-preview-info">
            <span class="ia-preview-name">${escHtml(t.titulo)}</span>
            <span class="ia-preview-sub">
              ${escHtml(t.materia)}${t.fecha_entrega ? " · 📅 " + fmtDate(t.fecha_entrega) : ""}
            </span>
          </div>
        </label>`).join("");

  body.innerHTML = `
    <p style="color:var(--text-muted);font-size:13px;margin-bottom:14px">
      Desmarcá lo que no quieras importar. Los cursos que ya existen vienen desmarcados.
    </p>
    <div class="ia-preview-scroll">
      <div class="ia-preview-section">
        <div class="ia-preview-section-title">📚 Cursos detectados (${cursos.length})</div>
        ${cursosHtml}
      </div>
      <div class="ia-preview-section" style="margin-top:16px">
        <div class="ia-preview-section-title">📋 Tareas detectadas (${tareas.length})</div>
        ${tareasHtml}
      </div>
    </div>
    <div class="form-actions" style="margin-top:18px">
      <button class="btn btn-ghost" onclick="openIAModal()">← Otra imagen</button>
      <button class="btn btn-primary" onclick="iaImportar()">✓ Importar seleccionados</button>
    </div>`;
}

async function iaImportar() {
  if (!_iaResultado) return;
  const { cursos, tareas } = _iaResultado;

  const selCursos = [...document.querySelectorAll(".ia-check-curso:checked")]
    .map(el => cursos[+el.dataset.idx]);
  const selTareas = [...document.querySelectorAll(".ia-check-tarea:checked")]
    .map(el => tareas[+el.dataset.idx]);

  if (selCursos.length === 0 && selTareas.length === 0) {
    showToast("No hay nada seleccionado para importar", "error");
    return;
  }

  const body = document.getElementById("modalBody");
  body.innerHTML = `
    <div style="text-align:center;padding:50px 20px">
      <div class="ia-spinner"></div>
      <p style="margin-top:18px;font-weight:600">Importando datos...</p>
    </div>`;

  let okC = 0, okT = 0;

  // 1. Crear cursos nuevos
  const existingMap = {};
  aulaCursos.forEach(c => { existingMap[c.nombre.toLowerCase()] = true; });

  for (const c of selCursos) {
    if (!existingMap[c.nombre.toLowerCase()]) {
      try {
        await apiFetch("/api/cursos", { method: "POST", body: JSON.stringify(c) });
        okC++;
      } catch (e) { console.warn("Curso no creado:", c.nombre, e.message); }
    }
  }

  // Refrescar lista de cursos para que las tareas tengan referencia correcta
  if (okC > 0) {
    aulaCursos = await apiFetch("/api/cursos").catch(() => aulaCursos);
  }

  // 2. Crear tareas
  for (const t of selTareas) {
    try {
      await apiFetch("/api/tareas", { method: "POST", body: JSON.stringify({
        titulo:       t.titulo,
        descripcion:  t.descripcion || null,
        materia:      t.materia,
        prioridad:    t.prioridad,
        fecha_entrega: t.fecha_entrega || null,
      })});
      okT++;
    } catch (e) { console.warn("Tarea no creada:", t.titulo, e.message); }
  }

  showToast(`✓ Importados: ${okC} curso${okC !== 1 ? "s" : ""}, ${okT} tarea${okT !== 1 ? "s" : ""}`, "success");
  closeModal();
  loadAula();
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

// ── HELPERS ──────────────────────────────────────────────────────────────────
function openConfirm(msg, onConfirm) {
  openModal("⚠️ Confirmar acción", `
    <p style="text-align:center;font-size:15px;line-height:1.5;margin:10px 0 24px">${escHtml(msg)}</p>
    <div class="form-actions" style="justify-content:center">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-danger" id="confirmOkBtn">Eliminar</button>
    </div>`);
  setTimeout(() => {
    const btn = document.getElementById("confirmOkBtn");
    if (btn) btn.onclick = () => { closeModal(); onConfirm(); };
  }, 50);
}

async function saveNotaInline(evalId, val) {
  const nota = val === "" ? null : parseFloat(val);
  if (val !== "" && isNaN(nota)) return;
  try {
    await apiFetch(`/api/cursos/evaluaciones/${evalId}`, {
      method: "PUT",
      body: JSON.stringify({ nota }),
    });
    showToast("Nota guardada ✓", "success");
    loadAula();
  } catch (e) {
    showToast(e.message, "error");
  }
}

async function savePesoInline(evalId, val) {
  const peso = parseFloat(val);
  if (isNaN(peso) || peso < 0 || peso > 100) return;
  try {
    await apiFetch(`/api/cursos/evaluaciones/${evalId}`, {
      method: "PUT",
      body: JSON.stringify({ peso }),
    });
    showToast("Peso actualizado ✓", "success");
    loadAula();
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ── INIT ──────────────────────────────────────────────────────────────────────
navigate("dashboard");
