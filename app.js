// app.js
import { initEngine, tossLine, buildReading, isContentLoaded, getProducts, getLicenses, getEntitlements, purchaseLocal, revokeLocal, trackEvent, getTelemetry } from "./engine.js";

const LS_KEY = "iching_tao_v0";
const LS_THEME = "iching_theme_v0";

const state = {
  nav: "home", // home | toss | reading | history | paywall
  boot: { ok: false, error: null, missing: null },
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

  // UI hooks
  const btnTheme = document.getElementById("btnTheme");
  if (btnTheme) btnTheme.addEventListener("click", onToggleTheme);

  const btnAbout = document.getElementById("btnAbout");
  if (btnAbout) btnAbout.addEventListener("click", openAbout);

  // Engine init
  try {
    await initEngine();
    state.boot.ok = true;

    // Sync Entitlements
    state.entitlements = getEntitlements();

    // Telemetry
    trackEvent("session_start");

  } catch (e) {
    state.boot.ok = false;
    state.boot.error = String(e?.message || e);

    if (e.missing && Array.isArray(e.missing)) {
      state.boot.missing = e.missing;
    }
  }

  // Set footer text dynamically if possible
  const licenses = getLicenses();
  if (licenses?.app_principles_es?.no_medical_substitution) {
    const footerText = document.getElementById("footerText");
    if (footerText) footerText.textContent = licenses.app_principles_es.no_medical_substitution;
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
  } catch { }
}

function saveLocal() {
  localStorage.setItem(LS_KEY, JSON.stringify({ history: state.history }));
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

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", name === "ink" ? "#1a1a18" : "#f3efe4");
}

// ---------- SW ----------
async function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("./sw.js");
  } catch { /* silent */ }
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
        // content pending check could happen here
      }
      const readingData = buildReading(state.draft.tosses);
      state.session = {
        id: cryptoRandomId(),
        created_at_iso: new Date().toISOString(),
        question: structuredClone(state.draft.question),
        tosses: structuredClone(state.draft.tosses),
        hexagrams: readingData
      };
      trackEvent("reading_view");
      nav("reading");
    } else {
      render();
    }
  } catch (e) {
    openModal("Error", `
      <p>No pude completar la tirada.</p>
      <p class="mono muted">${escapeHtml(String(e?.message || e))}</p>
    `);
  }
}

function saveSession() {
  if (!state.session) return;
  state.history.unshift(state.session);
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
  window.print();
}

function openPaywall(feature) {
  nav("paywall");
  state._paywallFeature = feature;
}

function unlockPremiumLocal() {
  // Use Engine logic now
  // Assuming first product is the one we want
  const prods = getProducts();
  if (prods?.products?.length > 0) {
    const pid = prods.products[0].product_id;
    state.entitlements = purchaseLocal(pid);
    render(); // re-render paywall
    openModal("Desbloqueado", `<p>Producto habilitado en Engine (local).</p>`);
  }
}

function lockPremiumLocal() {
  const prods = getProducts();
  if (prods?.products?.length > 0) {
    const pid = prods.products[0].product_id;
    state.entitlements = revokeLocal(pid);
    render();
    openModal("Bloqueado", `<p>Producto revocado.</p>`);
  }
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
  let details = "";
  if (state.boot.missing) {
    const listInfo = state.boot.missing.map(m => `<li>${escapeHtml(m)}</li>`).join("");
    details = `
      <div class="callout" style="margin-top:12px; border-left-color: var(--color-error);">
        <div class="callout__title">Archivos faltantes:</div>
        <ul>${listInfo}</ul>
      </div>
    `;
  }

  return `
    <section class="card">
      <div class="vstack">
        <div class="hstack">
          <div class="seal" aria-hidden="true">!</div>
          <div>
            <div class="hexTitle">No se pudo iniciar</div>
            <div class="muted">Faltan archivos o rutas.</div>
          </div>
        </div>
        <div class="divider"></div>
        <div class="mono muted">${escapeHtml(state.boot.error || "Error desconocido")}</div>
        ${details}
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
            <div class="hexTitle">Nueva consulta</div>
            <div class="muted">Plantea una pregunta abierta para iniciar.</div>
          </div>
          <span class="badge">${state.entitlements.premium_sections ? "Plus activo" : "Versión estándar"}</span>
        </div>

        <div class="divider"></div>

        <div class="vstack">
          <div>
            <div class="label">Foco / Ámbito</div>
            <select id="qMode">
              ${opt("reflexion", "Reflexión general")}
              ${opt("decision", "Toma de decisión")}
              ${opt("relacion", "Vínculos y relaciones")}
              ${opt("trabajo", "Trabajo y proyectos")}
              ${opt("salud", "Bienestar y salud")}
              ${opt("otro", "Otro")}
            </select>
          </div>

          <div>
            <div class="label">Pregunta</div>
            <textarea id="qText" placeholder="Ej: ¿Qué actitud conviene sostener ante esta situación?">${escapeHtml(state.draft.question.text_es || "")}</textarea>
          </div>

          <div class="row">
            <button class="btn btn--primary" id="btnBegin">Tirar monedas</button>
            <button class="btn btn--ghost" id="btnHistory">Historial (${state.history.length})</button>
            <button class="btn btn--ghost" id="btnPremium">${state.entitlements.premium_sections ? "Tu acceso" : "Desbloquear Plus"}</button>
          </div>
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
            <div class="hexTitle">Tirada de monedas</div>
            <div class="muted">Línea ${n + 1} de 6</div>
          </div>
          <span class="badge">${escapeHtml(state.draft.question.mode)}</span>
        </div>
        <div class="divider"></div>
        
        <div class="muted" style="font-style:italic;">“${escapeHtml(state.draft.question.text_es || "—")}”</div>
        
        <div class="divider"></div>

        <div class="vstack">
          ${n === 0 ? `<div class="muted">Tira las monedas para construir el hexagrama.</div>` : renderTosses(n)}
        </div>

        <div class="divider"></div>

        <div class="row">
          <button class="btn btn--primary" id="btnToss">${n < 6 ? "Tirar" : "Finalizar"}</button>
          <button class="btn btn--ghost" id="btnBackHome">Cancelar</button>
        </div>
      </div>
    </section>
  `;
}

function renderTosses(n) {
  return state.draft.tosses.map((t, idx) => {
    const lineNo = idx + 1;
    const moving = t.is_moving ? " (mutante)" : "";
    const bitText = t.line_bit === 1 ? "Yang" : "Yin";
    const coins = t.coins.map(c => {
      const isHeads = c === "heads";
      return `<div class="coin ${isHeads ? "coin--yang" : "coin--yin"}">${isHeads ? "●" : "○"}</div>`;
    }).join("");

    return `
      <div class="card" style="background:transparent; padding:10px;">
        <div class="row" style="justify-content:space-between;">
          <div class="muted">Línea ${lineNo}${moving} · ${bitText}</div>
          <div class="coins">${coins}</div>
        </div>
      </div>
    `;
  }).reverse().join(""); // mostramos la más reciente arriba si preferred, o normal. Let's keep normal but maybe styling? No, let's keep array order (bottom to top visually? usually hexagram builds up. Let's list naturally 1 to n).
}

function ReadingView() {
  if (!state.session) return `<div class="card"><div class="muted">Error de sesión.</div></div>`;

  const { primary, resulting, is_mutating } = state.session.hexagrams;
  const title = primary ? `${primary.id}. ${primary.hanzi} · ${primary.slug}` : "Unknown";

  // Flow: Core -> Image -> General -> Lines -> Resulting -> Premium

  const coreSection = `
    <div class="vstack">
      <div class="label">Núcleo Dinámico</div>
      <div style="font-size:1.1em; font-weight:500;">${escapeHtml(primary?.dynamic_core_es || "—")}</div>
    </div>
  `;

  const imageSection = `
    <div class="vstack">
      <div class="label">La Imagen</div>
      <div>${escapeHtml(primary?.image_es || "—")}</div>
    </div>
  `;

  const generalSection = `
    <div class="vstack">
      <div class="label">Lectura General</div>
      <div style="line-height:1.6;">${escapeHtml(primary?.general_reading_es || "—")}</div>
    </div>
  `;

  const linesSection = (primary?.active_lines_content?.length > 0)
    ? `
      <div class="divider"></div>
      <div class="vstack">
        <div class="label">Líneas Mutantes</div>
        ${primary.active_lines_content.map(l => `
          <div class="card" style="background:transparent;">
            <div class="muted" style="margin-bottom:4px;">Línea ${l.position}</div>
            <div>${escapeHtml(l.text)}</div>
          </div>
        `).join("")}
      </div>
    `
    : `<div class="divider"></div><div class="muted">Sin mutaciones. El hexagrama es estable.</div>`;

  const resultingSection = (is_mutating && resulting)
    ? `
      <div class="divider"></div>
      <div class="card" style="background:var(--panel2);">
        <div class="label">Tendencia Futura (Resultante)</div>
        <div class="row" style="margin-top:8px;">
          ${resulting.symbol_unicode ? `<div class="hexBig" style="font-size:32px;">${escapeHtml(resulting.symbol_unicode)}</div>` : ""}
          <div class="vstack" style="gap:2px;">
            <div style="font-weight:600;">${escapeHtml(resulting.id)}. ${escapeHtml(resulting.hanzi)}</div>
            <div class="muted">${escapeHtml(resulting.slug)}</div>
          </div>
        </div>
      </div>
    `
    : "";

  return `
    <section class="card">
      <div class="vstack">
        <!-- Header Lecture -->
        <div class="hstack" style="justify-content:space-between; align-items:flex-start;">
          <div class="row">
            ${primary?.symbol_unicode ? `<div class="hexBig">${escapeHtml(primary.symbol_unicode)}</div>` : ""}
            <div class="vstack" style="gap:2px;">
              <h1 class="hexTitle">${escapeHtml(title)}</h1>
              <div class="muted">${escapeHtml(state.session.created_at_iso.split("T")[0])}</div>
            </div>
          </div>
          <span class="badge">${escapeHtml(state.session.question.mode)}</span>
        </div>

        <div class="divider"></div>
        <div class="muted" style="font-style:italic;">“${escapeHtml(state.session.question.text_es)}”</div>
        <div class="divider"></div>

        ${coreSection}
        <div class="divider"></div>
        ${imageSection}
        <div class="divider"></div>
        ${generalSection}

        ${linesSection}
        ${resultingSection}

        <div class="divider"></div>
        ${renderPremiumSection(primary)}

        <div class="divider"></div>

        <div class="row">
          <button class="btn btn--ghost" id="btnClose">Cerrar</button>
          <button class="btn btn--ghost" id="btnSave">Guardar</button>
          <button class="btn btn--ghost" id="btnPDF">PDF</button>
        </div>
        
        <div class="muted" style="font-size:11px; margin-top:10px;">
          ${escapeHtml(primary?.ethics_note_es || "")}
        </div>
      </div>
    </section>
  `;
}

function renderPremiumSection(hex) {
  if (!hex) return "";

  if (state.entitlements.premium_sections) {
    const qs = Array.isArray(hex.guiding_questions_es) ? hex.guiding_questions_es : [];
    return `
      <div class="callout">
        <div class="callout__title">Lectura Profunda (Wu wei)</div>
        <div style="margin-bottom:10px;">${escapeHtml(hex.taoist_reading_es || "—")}</div>
        
        <div class="divider"></div>
        <div class="callout__title">Preguntas Guía</div>
        <ul style="padding-left:20px; margin:0;">
          ${qs.map(q => `<li>${escapeHtml(q)}</li>`).join("")}
        </ul>
        
        <div class="divider"></div>
        <div class="callout__title">Micro-acción</div>
        <div>${escapeHtml(hex.micro_action_es || "—")}</div>
      </div>
    `;
  } else {
    return `
      <div class="callout" style="cursor:pointer;" id="premiumLocked">
        <div class="callout__title">Lectura Profunda</div>
        <div class="blur">
          La perspectiva taoísta ofrece una estrategia de mínima resistencia para esta situación, enfocada en el Wu Wei...
        </div>
        <div class="row row--end" style="margin-top:10px;">
          <button class="btn btn--primary btn--sm">Desbloquear Plus</button>
        </div>
      </div>
    `;
  }
}

function HistoryView() {
  const rows = state.history.map((s) => {
    const p = s.hexagrams?.primary;
    const title = p ? `${p.id}. ${p.slug}` : "Sesión";
    return `
      <div class="card" style="background:transparent; padding:10px;">
        <div class="row" style="justify-content:space-between;">
          <div style="flex:1;">
            <div class="mono muted" style="font-size:11px;">${escapeHtml(s.created_at_iso.split("T")[0])}</div>
            <div style="font-weight:600;">${escapeHtml(title)}</div>
            <div class="muted" style="font-size:13px; font-style:italic; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; max-width:200px;">
              ${escapeHtml(s.question?.text_es || "—")}
            </div>
          </div>
          <button class="btn btn--ghost btn--sm" data-open="${escapeHtml(s.id)}">Ver</button>
        </div>
      </div>
    `;
  }).join("");

  return `
    <section class="card">
      <div class="vstack">
        <div class="hstack" style="justify-content:space-between;">
          <div class="hexTitle">Historial</div>
          <span class="badge">Local</span>
        </div>
        <div class="divider"></div>
        ${state.history.length ? `<div class="vstack">${rows}</div>` : `<div class="muted">No hay sesiones guardadas.</div>`}
        <div class="divider"></div>
        <div class="row">
          <button class="btn btn--ghost" id="btnBackHome2">Volver</button>
          <button class="btn btn--ghost" id="btnClearHistory">Borrar todo</button>
        </div>
      </div>
    </section>
  `;
}

function PaywallView() {
  const products = getProducts();
  const prod = products?.products?.[0]; // asumimos el primero
  const copy = products?.paywall_copy_es;

  // Fallbacks
  const title = copy?.title || "Premium";
  const body = copy?.body || "Desbloquea funciones.";
  const price = prod?.price?.formatted || "Consultar";

  const benefits = prod?.purchase_notes_es?.map(n => `<li>${escapeHtml(n)}</li>`).join("") || "";

  return `
    <section class="card">
      <div class="vstack">
        <div class="hexTitle">${escapeHtml(title)}</div>
        <div style="white-space:pre-wrap; line-height:1.5;">${escapeHtml(body)}</div>
        
        <div class="divider"></div>
        
        <div class="card" style="background:var(--panel2);">
          <div class="hstack" style="justify-content:space-between;">
            <div style="font-weight:bold;">${escapeHtml(prod?.title_es || "Acceso Total")}</div>
            <div class="badge" style="background:var(--accent); color:var(--bg); border:none;">${escapeHtml(price)}</div>
          </div>
          <ul style="margin:10px 0 0; padding-left:20px; font-size:13px; color:var(--muted);">
            ${benefits}
          </ul>
        </div>

        <div class="divider"></div>

        <div class="row">
          <button class="btn btn--primary" id="btnUnlockLocal">Simular Compra</button>
          <button class="btn btn--ghost" id="btnLockLocal">Restaurar / Bloquear</button>
          <button class="btn btn--ghost" id="btnBackHome3">Volver</button>
        </div>
        
        <div class="muted" style="font-size:11px; text-align:center;">
          ${escapeHtml(copy?.footer_note || "Uso local.")}
        </div>
      </div>
    </section>
  `;
}

// ---------- Bind events ----------
function bindCommon(root) {
  // Home
  const btnBegin = root.querySelector("#btnBegin");
  if (btnBegin) {
    const qText = root.querySelector("#qText");
    qText?.addEventListener("input", (e) => state.draft.question.text_es = e.target.value);

    const qMode = root.querySelector("#qMode");
    qMode?.addEventListener("change", (e) => state.draft.question.mode = e.target.value);

    // restore values
    if (qText) qText.value = state.draft.question.text_es;
    if (qMode) qMode.value = state.draft.question.mode;

    btnBegin.addEventListener("click", () => {
      if (!state.draft.question.text_es.trim()) {
        openModal("Falta pregunta", "<p>Por favor escribe algo para reflexionar.</p>");
        return;
      }
      beginToss();
    });

    root.querySelector("#btnHistory")?.addEventListener("click", openHistory);
    root.querySelector("#btnPremium")?.addEventListener("click", () => openPaywall("home"));
  }

  // Toss
  root.querySelector("#btnToss")?.addEventListener("click", onTossNextLine);
  root.querySelector("#btnBackHome")?.addEventListener("click", startNew); // Cancelar = startNew

  // Reading
  root.querySelector("#btnClose")?.addEventListener("click", startNew);
  root.querySelector("#btnSave")?.addEventListener("click", saveSession);
  root.querySelector("#btnPDF")?.addEventListener("click", exportPDF);
  root.querySelector("#premiumLocked")?.addEventListener("click", () => openPaywall("reading"));

  // History
  root.querySelector("#btnBackHome2")?.addEventListener("click", () => nav("home"));
  root.querySelector("#btnClearHistory")?.addEventListener("click", deleteHistory);
  root.querySelectorAll("[data-open]").forEach(b => {
    b.addEventListener("click", () => {
      const id = b.getAttribute("data-open");
      const found = state.history.find(x => x.id === id);
      if (found) {
        state.session = found;
        nav("reading");
      }
    });
  });

  // Paywall
  root.querySelector("#btnUnlockLocal")?.addEventListener("click", unlockPremiumLocal);
  root.querySelector("#btnLockLocal")?.addEventListener("click", lockPremiumLocal);
  root.querySelector("#btnBackHome3")?.addEventListener("click", () => nav("home"));
}

function openModal(title, body) {
  const m = document.getElementById("modal");
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").innerHTML = body;
  m.showModal();
}

function openAbout() {
  const lic = getLicenses();
  const principles = lic?.app_principles_es || {};
  const stats = getTelemetry();

  const content = `
    <div class="vstack" style="gap:12px;">
      <p><strong>Reflexión, no predicción.</strong> ${escapeHtml(principles.non_predictive || "")}</p>
      <p><strong>Enfoque.</strong> ${escapeHtml(principles.taoist_orientation || "")}</p>
      <div class="callout">
        ${escapeHtml(principles.no_medical_substitution || "No sustituye ayuda profesional.")}
      </div>
      <div class="divider"></div>
      <div class="label">Tus estadísticas (Local)</div>
      <div class="hstack" style="justify-content:space-between; font-size:13px;">
          <div>Sesiones: <b>${stats.sessions || 0}</b></div>
          <div>Lecturas: <b>${stats.readings || 0}</b></div>
      </div>
      <div class="divider"></div>
      <p class="muted" style="font-size:12px;">Versión 0.1.1 · Local Storage</p>
    </div>
  `;
  openModal("Acerca de", content);
}

// Utils
function opt(val, lbl) { return `<option value="${val}">${lbl}</option>`; }
function htmlToNode(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
function escapeHtml(s) {
  if (!s) return "";
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
function cryptoRandomId() {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a).map(b => b.toString(16).padStart(2, "0")).join("");
}
