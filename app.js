import { initEngine, tossLine, buildReading, isContentLoaded } from "./engine.js";

const LS_KEY = "iching_tao_v0";
const LS_THEME = "iching_theme_v0";
const LS_ENT = "iching_entitlements_v0";

const state = {
  nav: "home", // home | toss | reading | history | paywall
  boot: { ok: false, error: null },
  draft: {
    question: { text_es: "", mode: "reflexion" }, // reflexion | decision | relacion | trabajo | salud | otro
    tosses: []
  },
  session: null,
  history: [],
  entitlements: {
    premium_sections: false
  }
};

// ---------- Boot ----------
boot();

async function boot() {
  loadLocal();

  // Theme init
  const savedTheme = localStorage.getItem(LS_THEME) || "ink";
  applyTheme(savedTheme);

  // UI hooks (topbar)
  document.getElementById("btnTheme").addEventListener("click", onToggleTheme);
  document.getElementById("btnAbout").addEventListener("click", openAbout);

  // Engine init
  try {
    await initEngine();
    state.boot.ok = true;
  } catch (e) {
    state.boot.ok = false;
    state.boot.error = String(e?.message || e);
  }

  // SW register
  registerSW();

  render();
}

// ---------- Storage ----------
function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.history)) state.history = parsed.history;
    }
  } catch {}

  try {
    const ent = localStorage.getItem(LS_ENT);
    if (ent) state.entitlements = { ...state.entitlements, ...JSON.parse(ent) };
  } catch {}
}

function saveLocal() {
  localStorage.setItem(LS_KEY, JSON.stringify({ history: state.history }));
  localStorage.setItem(LS_ENT, JSON.stringify(state.entitlements));
}

// ---------- Theme ----------
function onToggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme") || "ink";
  const next = cur === "paper" ? "ink" : "paper";
  applyTheme(next);
}

function applyTheme(name) {
  if (name === "paper") document.documentElement.setAttribute("data-theme", "paper");
  else document.documentElement.removeAttribute("data-theme");
  localStorage.setItem(LS_THEME, name);
}

// ---------- SW ----------
async function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("./sw.js");
  } catch {
    // silencioso: la app sigue funcionando sin SW
  }
}

// ---------- Navigation ----------
function nav(to) {
  state.nav = to;
  render();
}

// ---------- Actions ----------
function startNew() {
  state.draft = { question: { text_es: "", mode: "reflexion" }, tosses: [] };
  state.session = null;
  nav("home");
}

function beginToss() {
  state.draft.tosses = [];
  state.session = null;
  nav("toss");
}

function onTossNextLine() {
  if (!state.boot.ok) return;

  if (state.draft.tosses.length >= 6) return;

  try {
    const t = tossLine();
    state.draft.tosses.push(t);

    if (state.draft.tosses.length === 6) {
      if (!isContentLoaded()) {
        // contenido aún no listo: esperar un render más y permitir reintento
        // pero construimos igual (el engine lanza si no está cargado)
      }
      const readingData = buildReading(state.draft.tosses);
      state.session = {
        id: cryptoRandomId(),
        created_at_iso: new Date().toISOString(),
        question: structuredClone(state.draft.question),
        tosses: structuredClone(state.draft.tosses),
        hexagrams: readingData
      };
      nav("reading");
    } else {
      render();
    }
  } catch (e) {
    openModal("Error", `
      <p>No pude completar la tirada.</p>
      <p class="mono muted">${escapeHtml(String(e?.message || e))}</p>
      <p class="muted">Verifica que <span class="mono">/data</span> exista y que <span class="mono">hexagrams_core.json</span> esté accesible.</p>
    `);
  }
}

function saveSession() {
  if (!state.session) return;
  state.history.unshift(state.session);
  // límite simple
  state.history = state.history.slice(0, 200);
  saveLocal();
  openModal("Guardado", `<p>Sesión guardada en este dispositivo.</p>`);
}

function openHistory() {
  nav("history");
}

function deleteHistory() {
  state.history = [];
  saveLocal();
  openModal("Historial borrado", `<p>Listo. No queda nada guardado en este navegador para esta app.</p>`);
}

function exportPDF() {
  // Minimal: usa print del navegador (sirve en Android/Chrome como “Guardar PDF”)
  window.print();
}

function openPaywall(feature) {
  nav("paywall");
  // store feature requested if needed in the future
  state._paywallFeature = feature;
}

function unlockPremiumLocal() {
  // Simulación local (sin tienda): útil para pruebas.
  state.entitlements.premium_sections = true;
  saveLocal();
  openModal("Desbloqueado (local)", `<p>Se activó <span class="mono">premium_sections</span> en este dispositivo.</p>`);
}

function lockPremiumLocal() {
  state.entitlements.premium_sections = false;
  saveLocal();
  openModal("Bloqueado", `<p>Se desactivó <span class="mono">premium_sections</span>.</p>`);
}

// ---------- Render ----------
function render() {
  const root = document.getElementById("app");
  root.innerHTML = "";

  if (!state.boot.ok) {
    root.appendChild(htmlToNode(BootErrorView()));
    bindCommon(root);
    return;
  }

  if (state.nav === "home") root.appendChild(htmlToNode(HomeView()));
  if (state.nav === "toss") root.appendChild(htmlToNode(TossView()));
  if (state.nav === "reading") root.appendChild(htmlToNode(ReadingView()));
  if (state.nav === "history") root.appendChild(htmlToNode(HistoryView()));
  if (state.nav === "paywall") root.appendChild(htmlToNode(PaywallView()));

  bindCommon(root);
}

function BootErrorView() {
  return `
    <section class="card">
      <div class="vstack">
        <div class="hstack">
          <div class="seal" aria-hidden="true">!</div>
          <div>
            <div class="hexTitle">No se pudo iniciar</div>
            <div class="muted">Faltan archivos o rutas en <span class="mono">/data</span>.</div>
          </div>
        </div>
        <div class="divider"></div>
        <div class="mono muted">${escapeHtml(state.boot.error || "Error desconocido")}</div>
        <div class="divider"></div>
        <div class="muted">
          Revisa que exista: <span class="mono">data/dataset_manifest.json</span> y que sus paths coincidan con tu tree.
        </div>
      </div>
    </section>
  `;
}

function HomeView() {
  return `
    <section class="card">
      <div class="vstack">
        <div class="hstack" style="justify-content:space-between; align-items:flex-start;">
          <div class="vstack" style="gap:6px;">
            <div class="hexTitle">Plantea una pregunta útil</div>
            <div class="muted">Guía reflexiva. No predice. No promete. No sustituye criterio clínico ni decisiones profesionales.</div>
          </div>
          <span class="badge">${state.entitlements.premium_sections ? "profundidad: activa" : "profundidad: bloqueada"}</span>
        </div>

        <div class="divider"></div>

        <div class="vstack">
          <div>
            <div class="label">Modo</div>
            <select id="qMode">
              ${opt("reflexion","Reflexión")}
              ${opt("decision","Decisión")}
              ${opt("relacion","Relación")}
              ${opt("trabajo","Trabajo")}
              ${opt("salud","Salud")}
              ${opt("otro","Otro")}
            </select>
          </div>

          <div>
            <div class="label">Pregunta (en una frase operativa)</div>
            <textarea id="qText" placeholder="Ej: ¿Qué actitud reduce fricción en esta situación esta semana?">${escapeHtml(state.draft.question.text_es || "")}</textarea>
            <div class="muted" style="margin-top:6px;">Tip: evita “¿qué va a pasar?”; usa “¿qué conviene practicar?”</div>
          </div>

          <div class="row">
            <button class="btn btn--primary" id="btnBegin">Tirar monedas</button>
            <button class="btn btn--ghost" id="btnHistory">Historial (${state.history.length})</button>
            <button class="btn btn--ghost" id="btnPremium">${state.entitlements.premium_sections ? "Gestionar acceso" : "Desbloquear profundidad"}</button>
          </div>
        </div>

        <div class="divider"></div>

        <div class="muted">
          Uso local: la app guarda historial solo en <span class="mono">localStorage</span> del navegador.
        </div>
      </div>
    </section>
  `;
}

function TossView() {
  const n = state.draft.tosses.length;

  return `
    <section class="card">
      <div class="vstack">
        <div class="hstack" style="justify-content:space-between; align-items:flex-start;">
          <div class="vstack" style="gap:6px;">
            <div class="hexTitle">Tirada de 3 monedas</div>
            <div class="muted">Línea ${n + 1} de 6 (de abajo hacia arriba).</div>
          </div>
          <span class="badge">${escapeHtml(state.draft.question.mode)}</span>
        </div>

        <div class="divider"></div>

        <div class="card" style="background:var(--panel2);">
          <div class="label">Pregunta</div>
          <div style="margin-top:6px;">“${escapeHtml(state.draft.question.text_es || "—")}”</div>
        </div>

        <div class="divider"></div>

        <div class="vstack">
          <div class="label">Tiradas</div>
          ${n === 0 ? `<div class="muted">Aún no has tirado monedas.</div>` : renderTosses(n)}
        </div>

        <div class="divider"></div>

        <div class="row">
          <button class="btn btn--primary" id="btnToss">${n < 6 ? "Tirar" : "Listo"}</button>
          <button class="btn btn--ghost" id="btnBackHome">Volver</button>
        </div>

        <div class="muted">
          Nota: la aleatoriedad usa <span class="mono">Math.random()</span>. Si luego quieres auditable/criptográfico, se cambia a <span class="mono">crypto.getRandomValues</span>.
        </div>
      </div>
    </section>
  `;
}

function renderTosses(n) {
  const blocks = state.draft.tosses.map((t, idx) => {
    const lineNo = idx + 1;
    const moving = t.is_moving ? " (mutante)" : "";
    const bit = t.line_bit === 1 ? "Yang" : "Yin";
    const coins = t.coins.map(c => {
      const yang = (c === "heads");
      return `<div class="coin ${yang ? "coin--yang" : "coin--yin"}" title="${yang ? "heads" : "tails"}">${yang ? "●" : "○"}</div>`;
    }).join("");

    return `
      <div class="card" style="background:transparent;">
        <div class="row" style="justify-content:space-between;">
          <div class="muted">Línea ${lineNo}${moving}</div>
          <div class="mono muted">suma=${t.sum} · ${bit} · bit=${t.line_bit} → ${t.transforms_to_bit}</div>
        </div>
        <div class="coins" style="margin-top:8px;">${coins}</div>
      </div>
    `;
  }).join("");

  return `<div class="vstack">${blocks}</div>`;
}

function ReadingView() {
  if (!state.session) {
    return `<section class="card"><div class="muted">No hay sesión actual.</div></section>`;
  }

  const { primary, resulting, is_mutating } = state.session.hexagrams;

  const title = primary
    ? `${primary.id}. ${primary.hanzi} · ${primary.slug}`
    : "Hexagrama no identificado (revisa hexagrams_meta.json)";

  const activeLinesHTML = (primary?.active_lines_content?.length || 0) > 0
    ? `
      <div class="divider"></div>
      <div class="vstack">
        <div class="label">Líneas activas</div>
        ${primary.active_lines_content.map(l =>
          `<div class="card" style="background:transparent;">
            <div class="muted">Línea ${l.position}</div>
            <div style="margin-top:6px;">${escapeHtml(l.text)}</div>
          </div>`
        ).join("")}
      </div>
    `
    : `<div class="divider"></div><div class="muted">Sin líneas mutantes (lectura estable).</div>`;

  const resultingHTML = is_mutating && resulting
    ? `
      <div class="divider"></div>
      <div class="card" style="background:transparent;">
        <div class="label">Hexagrama resultante</div>
        <div style="margin-top:6px;">
          ${resulting.symbol_unicode ? `<div class="hexBig">${escapeHtml(resulting.symbol_unicode)}</div>` : ""}
          <div>${escapeHtml(String(resulting.id))}. ${escapeHtml(resulting.hanzi)} · ${escapeHtml(resulting.slug)}</div>
        </div>
      </div>
    `
    : "";

  return `
    <section class="card">
      <div class="vstack">
        <div class="hstack" style="justify-content:space-between; align-items:flex-start;">
          <div class="vstack" style="gap:6px;">
            ${primary?.symbol_unicode ? `<div class="hexBig">${escapeHtml(primary.symbol_unicode)}</div>` : ""}
            <h1 class="hexTitle" style="margin:0;">${escapeHtml(title)}</h1>
            <div class="muted">${escapeHtml(state.session.created_at_iso)}</div>
          </div>
          <span class="badge">${escapeHtml(state.session.question.mode)}</span>
        </div>

        <div class="divider"></div>

        <div class="card" style="background:transparent;">
          <div class="label">Pregunta</div>
          <div style="margin-top:6px;">“${escapeHtml(state.session.question.text_es || "—")}”</div>
        </div>

        <div class="divider"></div>

        <div class="vstack">
          <div class="label">Núcleo</div>
          <div>${escapeHtml(primary?.dynamic_core_es || "—")}</div>
        </div>

        <div class="divider"></div>

        <div class="vstack">
          <div class="label">Imagen</div>
          <div>${escapeHtml(primary?.image_es || "—")}</div>
        </div>

        <div class="divider"></div>

        <div class="vstack">
          <div class="label">Lectura general</div>
          <div>${escapeHtml(primary?.general_reading_es || "—")}</div>
        </div>

        ${activeLinesHTML}
        ${resultingHTML}

        <div class="divider"></div>
        ${renderPremiumSection(primary)}

        <div class="divider"></div>

        <div class="row">
          <button class="btn btn--ghost" id="btnClose">Cerrar</button>
          <button class="btn btn--ghost" id="btnSave">Guardar</button>
          <button class="btn btn--ghost" id="btnPDF">PDF</button>
        </div>

        <div class="muted">
          Nota ética: ${escapeHtml(primary?.ethics_note_es || "—")}
        </div>
      </div>
    </section>
  `;
}

function renderPremiumSection(hex) {
  if (!hex) return `<div class="muted">Sin datos premium.</div>`;

  if (state.entitlements.premium_sections) {
    const qs = Array.isArray(hex.guiding_questions_es) ? hex.guiding_questions_es : [];
    return `
      <div class="callout">
        <div class="callout__title">Lectura taoísta (Wu wei)</div>
        <div>${escapeHtml(hex.taoist_reading_es || "—")}</div>

        <div class="divider"></div>

        <div class="callout__title">Preguntas guía</div>
        ${qs.length ? `<ul>${qs.map(q => `<li>${escapeHtml(q)}</li>`).join("")}</ul>` : `<div class="muted">—</div>`}

        <div class="divider"></div>

        <div class="callout__title">Micro-acción</div>
        <div>${escapeHtml(hex.micro_action_es || "—")}</div>
      </div>
    `;
  }

  return `
    <div class="callout" style="cursor:pointer;" id="premiumLocked">
      <div class="callout__title">Lectura taoísta + guía práctica</div>
      <div class="blur">En clave taoísta, este hexagrama sugiere una forma concreta de reducir fricción y sostener el proceso…</div>
      <div class="row" style="margin-top:10px;">
        <button class="btn btn--primary btn--sm" type="button">Desbloquear</button>
      </div>
    </div>
  `;
}

function HistoryView() {
  const rows = state.history.map((s) => {
    const p = s.hexagrams?.primary;
    const title = p ? `${p.id}. ${p.hanzi} · ${p.slug}` : "Sesión";
    return `
      <div class="card" style="background:transparent;">
        <div class="row" style="justify-content:space-between;">
          <div>
            <div class="mono muted">${escapeHtml(s.created_at_iso)}</div>
            <div style="margin-top:6px;">${escapeHtml(title)}</div>
            <div class="muted" style="margin-top:6px;">“${escapeHtml(s.question?.text_es || "—")}”</div>
          </div>
          <div class="row">
            <button class="btn btn--ghost btn--sm" data-open="${escapeHtml(s.id)}">Abrir</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  return `
    <section class="card">
      <div class="vstack">
        <div class="hstack" style="justify-content:space-between;">
          <div>
            <div class="hexTitle">Historial</div>
            <div class="muted">${state.history.length} sesiones (local)</div>
          </div>
          <span class="badge">localStorage</span>
        </div>

        <div class="divider"></div>

        ${state.history.length ? `<div class="vstack">${rows}</div>` : `<div class="muted">Aún no hay sesiones guardadas.</div>`}

        <div class="divider"></div>

        <div class="row">
          <button class="btn btn--ghost" id="btnBackHome2">Volver</button>
          <button class="btn btn--ghost" id="btnClearHistory">Borrar historial</button>
        </div>
      </div>
    </section>
  `;
}

function PaywallView() {
  return `
    <section class="card">
      <div class="vstack">
        <div class="hexTitle">Acceso a “Lectura Profunda”</div>
        <div class="muted">Aquí va tu integración real (Play Billing / App Store / Stripe). Por ahora hay “unlock local” para pruebas.</div>

        <div class="divider"></div>

        <div class="card" style="background:transparent;">
          <div class="label">Estado</div>
          <div style="margin-top:6px;">
            ${state.entitlements.premium_sections ? "✅ premium_sections activo" : "⛔ premium_sections inactivo"}
          </div>
        </div>

        <div class="divider"></div>

        <div class="row">
          <button class="btn btn--primary" id="btnUnlockLocal">Unlock local (testing)</button>
          <button class="btn btn--ghost" id="btnLockLocal">Bloquear</button>
          <button class="btn btn--ghost" id="btnBackHome3">Volver</button>
        </div>

        <div class="muted">
          En producción: esta pantalla debería leer <span class="mono">products.json</span> + <span class="mono">licenses.json</span>, y verificar entitlements firmados.
        </div>
      </div>
    </section>
  `;
}

// ---------- Bind events ----------
function bindCommon(root) {
  // Home
  const qMode = root.querySelector("#qMode");
  const qText = root.querySelector("#qText");
  const btnBegin = root.querySelector("#btnBegin");
  const btnHistory = root.querySelector("#btnHistory");
  const btnPremium = root.querySelector("#btnPremium");

  if (qMode) {
    qMode.value = state.draft.question.mode;
    qMode.addEventListener("change", () => {
      state.draft.question.mode = qMode.value;
    });
  }
  if (qText) {
    qText.addEventListener("input", () => {
      state.draft.question.text_es = qText.value.slice(0, 800);
    });
  }
  if (btnBegin) {
    btnBegin.addEventListener("click", () => {
      if (!state.draft.question.text_es.trim()) {
        openModal("Falta la pregunta", `<p>Escribe una pregunta breve (operativa) antes de tirar monedas.</p>`);
        return;
      }
      beginToss();
    });
  }
  if (btnHistory) btnHistory.addEventListener("click", openHistory);
  if (btnPremium) btnPremium.addEventListener("click", () => nav("paywall"));

  // Toss
  const btnToss = root.querySelector("#btnToss");
  const btnBackHome = root.querySelector("#btnBackHome");
  if (btnToss) btnToss.addEventListener("click", onTossNextLine);
  if (btnBackHome) btnBackHome.addEventListener("click", () => nav("home"));

  // Reading
  const btnClose = root.querySelector("#btnClose");
  const btnSave = root.querySelector("#btnSave");
  const btnPDF = root.querySelector("#btnPDF");
  const premiumLocked = root.querySelector("#premiumLocked");

  if (btnClose) btnClose.addEventListener("click", () => nav("home"));
  if (btnSave) btnSave.addEventListener("click", saveSession);
  if (btnPDF) btnPDF.addEventListener("click", exportPDF);
  if (premiumLocked) premiumLocked.addEventListener("click", () => openPaywall("premium_sections"));

  // History
  const btnBackHome2 = root.querySelector("#btnBackHome2");
  const btnClearHistory = root.querySelector("#btnClearHistory");
  if (btnBackHome2) btnBackHome2.addEventListener("click", () => nav("home"));
  if (btnClearHistory) btnClearHistory.addEventListener("click", deleteHistory);

  root.querySelectorAll("[data-open]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-open");
      const found = state.history.find(x => x.id === id);
      if (found) {
        state.session = found;
        nav("reading");
      }
    });
  });

  // Paywall
  const btnUnlockLocal = root.querySelector("#btnUnlockLocal");
  const btnLockLocal = root.querySelector("#btnLockLocal");
  const btnBackHome3 = root.querySelector("#btnBackHome3");
  if (btnUnlockLocal) btnUnlockLocal.addEventListener("click", unlockPremiumLocal);
  if (btnLockLocal) btnLockLocal.addEventListener("click", lockPremiumLocal);
  if (btnBackHome3) btnBackHome3.addEventListener("click", () => nav("home"));
}

// ---------- Modal ----------
function openModal(title, bodyHtml) {
  const modal = document.getElementById("modal");
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").innerHTML = bodyHtml;
  modal.showModal();
}

function openAbout() {
  openModal("Acerca de", `
    <p>Esta app implementa una lectura del I Ching como guía reflexiva, sin promesas de adivinación.</p>
    <ul>
      <li>Funciona local en el dispositivo.</li>
      <li>Historial opcional: se guarda en <span class="mono">localStorage</span>.</li>
      <li>No reemplaza criterio clínico, legal o profesional.</li>
    </ul>
    <p class="muted">Si quieres “cierre monetización real”: integramos tienda y entitlements firmados.</p>
  `);
}

// ---------- Utils ----------
function opt(value, label) {
  return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function htmlToNode(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function cryptoRandomId() {
  // sin deps, suficientemente único para historial local
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a).map(b => b.toString(16).padStart(2, "0")).join("");
}
