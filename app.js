import { BubbleMenu, Typewriter, InkGalaxy, TiltCard, ShaoYongCircle } from "./ui-lib.js";
import {
  initEngine,
  trackEvent,
  tossLine,
  tossYarrowLine,
  setMethod,
  buildReading,
  t
} from "./engine.js";

// Global UI Instances
let sageTyper = null;
let bubbleMenu = null;
let galaxy = null;

var state = {
  // Boot status
  boot: { ok: true, missing: [], error: null },

  // Navigation: 'home' | 'toss' | 'reading' | 'history'
  nav: "home",

  // Data
  history: [], // Array of sessions

  // Current Session Draft
  draft: {
    question: { text_es: "", mode: "reflexion" }, // modos: reflexion, decision, relacion, trabajo, salud
    tosses: [] // Array of { coins: ['heads','tails','heads'], value: 7/8/6/9, ... }
  },

  // Active Session (Displaying Reading)
  session: null,

  // UI State
  _tossing: false, // animation lock
  // Entitlements (Paid app: everything unlocked after purchase)
  entitlements: {
    unlimited_history: true,
    premium_sections: true,
    pdf_export: true
  },
  _bookOpen: false,
  readingMode: "zen", // "zen" | "oracle" | "study"
  divinationMethod: "three_coins" // "three_coins" | "yarrow_stalks"
};

// ---------- Init ----------
// Se ejecuta al cargar el script (module)
(async function init() {
  loadLocal();

  // Handle URL params or redirects if needed
  if (!state.history) state.history = [];

  // Init Menu
  initBubbleMenu();

  // Init Ink Galaxy Background
  galaxy = new InkGalaxy({ count: 180 });

  try {
    // Attempt boot checks
    await initEngine();
    state.boot.ok = true;

    // Telemetry
    trackEvent("session_start");

  } catch (e) {
    state.boot.ok = false;
    state.boot.error = String(e?.message || e);
    if (e.missing && Array.isArray(e.missing)) {
      state.boot.missing = e.missing;
    }
  }

  // SW register
  registerSW();

  render();
})();

function initBubbleMenu() {
  bubbleMenu = new BubbleMenu({
    container: document.getElementById("app"),
    items: [
      { id: "home", icon: "🏠", label: t("menu.home"), onClick: () => startNew() },
      { id: "history", icon: "📜", label: t("menu.history"), onClick: () => openHistory() },
      { id: "theme", icon: "🌗", label: t("menu.theme"), onClick: () => onToggleTheme() },
    ]
  });
}

// ---------- Storage ----------
function loadLocal() {
  try {
    const data = localStorage.getItem(LS_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      state.history = parsed.history || [];
    }
    const theme = localStorage.getItem(LS_THEME);
    if (theme) applyTheme(theme);
  } catch (e) { console.error("Load fail", e); }
}

function saveLocal() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ history: state.history }));
  } catch (e) { console.error("Save fail", e); }
}

// ---------- Theme ----------
function onToggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "paper";
  const next = current === "paper" ? "dark" : "paper";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem(LS_THEME, next);
}

function setReadingMode(mode) {
  state.readingMode = mode;
  document.documentElement.setAttribute("data-mode", mode);
  render();
}

function onMethodToggle() {
  const next = state.divinationMethod === "three_coins" ? "yarrow_stalks" : "three_coins";
  state.divinationMethod = next;
  setMethod(next);
  render();
}

window.setReadingMode = setReadingMode;
window.onMethodToggle = onMethodToggle;
window.openHexagramDetail = openHexagramDetail;

function renderStudyReading(hex) {
  if (!hex) return "";
  return `
    <div class="divider"></div>
    <section class="vstack" style="gap:20px;">
      <div class="card" style="border-top:4px solid var(--gold);">
         <h4 class="serif" style="margin-top:0;">Perspectiva de Wilhelm</h4>
         <p class="serif" style="font-size:0.95rem; opacity:0.9;">${escapeHtml(hex.wilhelm_essence_es || "Cargando esencia...")}</p>
      </div>
      <div class="card" style="border-top:4px solid var(--accent);">
         <h4 class="serif" style="margin-top:0;">Comentario de Legge (Estructura)</h4>
         <p class="serif" style="font-size:0.95rem; opacity:0.9;">${escapeHtml(hex.legge_commentary_es || "Analizando estructura...")}</p>
      </div>
    </section>
  `;
}

// ---------- SW ----------
async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('./sw.js');
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

function saveSession() {
  if (!state.session) return;

  // Normal save
  performSave(false);
}

function performSave(overwrite) {
  trackEvent("session_saved", { overwrite: overwrite });
  if (overwrite) {
    state.history = [state.session];
    openModal(t("history.modal_saved_title"), `<p>${t("history.alert_replaced")}</p>`);
  } else {
    state.history.unshift(state.session);
    state.history = state.history.slice(0, 200);
    openModal(t("history.modal_saved_title"), `<p>${t("history.modal_saved_body")}</p>`);
  }
  saveLocal();
  render();
}

function openHistory() {
  nav("history");
}

function deleteHistory() {
  state.history = [];
  saveLocal();
  openModal(t("history.modal_cleared_title"), `<p>${t("history.modal_cleared_body")}</p>`);
}

function exportPDF() {
  window.print();
}

// ---------- Render ----------
function render() {
  const root = document.getElementById("app");
  if (!root) return;

  // 1. Ensure Shell (Book structure) exists
  if (!document.getElementById("theBook")) {
    root.innerHTML = BookShellHTML();
    bindShellEvents();
  }

  // 2. Update Shell State (Open/Closed)
  const book = document.getElementById("theBook");
  if (state._bookOpen) {
    book.classList.add("open");
    document.body.classList.add("book-is-open");
  } else {
    book.classList.remove("open");
    document.body.classList.remove("book-is-open");
  }

  // 3. Render Page Content inside the Book
  const pageContainer = document.getElementById("bookPageContent");
  if (!pageContainer) return;

  // If boot error, override
  if (!state.boot.ok) {
    pageContainer.innerHTML = BootErrorView();
    return;
  }

  let contentHTML = "";
  switch (state.nav) {
    case "home": contentHTML = renderHome(); break;
    case "toss": contentHTML = TossView(); break;
    case "reading": contentHTML = renderReading(); break;
    case "history": contentHTML = HistoryView(); break;
    default: contentHTML = renderHome();
  }

  pageContainer.innerHTML = `<div class="fade-in">${contentHTML}</div>`;

  // 4. Post-Render logic
  bindPageEvents(pageContainer);
  initPageEffects();
}

function BookShellHTML() {
  return `
    <div class="app-container">
      <div class="content-wrapper">
        <div class="book-scene">
           <div class="book" id="theBook">
              <!-- Cover -->
              <div class="book-face book-front">
                 <div class="vstack" style="align-items:center; gap:40px;">
                    <div class="seal" style="width:80px; height:80px; font-size:32px;">IC</div>
                    <div style="text-align:center;">
                       <h1 style="font-size:3rem; margin:0; color:var(--gold);">I CHING</h1>
                       <p class="serif" style="font-style:italic; opacity:0.8;">El Libro de las Mutaciones</p>
                    </div>
                    <button class="btn btn--primary" id="btnOpenBook" style="padding:20px 40px; font-size:1.2rem;">Consultar el Oráculo</button>
                 </div>
              </div>

              <!-- Inside (Pages) -->
              <div class="book-face book-inside">
                 <div id="bookPageContent" class="vstack" style="flex:1;"></div>
                 
                 <div class="divider"></div>
                 <div style="text-align:center;" class="muted serif">
                    Reflexión Local · v1.1
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  `;
}

function renderHome() {
  const container = document.getElementById("app");

  container.innerHTML = `
    <div class="vstack" style="text-align:center;">
      <h1 class="hexTitle" style="font-size:3rem; margin-bottom:10px;">I Ching</h1>
      <p class="muted serif" style="font-style:italic;">"${t("home.tagline")}"</p>
      
      <div id="shao-yong-box" class="shaoYongContainer"></div>

      <div class="card vstack" style="gap:20px; background:var(--accent-soft); padding:30px;">
         <p class="serif" style="margin:0;">¿Qué buscas comprender hoy?</p>
         <div class="row" style="gap:10px; justify-content:center;">
            <button class="btn btn--ghost ${state.readingMode === 'zen' ? 'active' : ''}" onclick="setReadingMode('zen')">Zen</button>
            <button class="btn btn--ghost ${state.readingMode === 'oracle' ? 'active' : ''}" onclick="setReadingMode('oracle')">Oráculo</button>
            <button class="btn btn--ghost ${state.readingMode === 'study' ? 'active' : ''}" onclick="setReadingMode('study')">Estudio</button>
         </div>
         <button class="btn btn--primary" id="btnStart" style="width:100%;">${t("home.cta")}</button>
         
         <div class="muted serif" style="font-size:0.8rem; cursor:pointer;" onclick="onMethodToggle()">
            Método: <b>${state.divinationMethod === 'three_coins' ? 'Tres Monedas' : 'Varillas (Dayan)'}</b>
            <span style="display:block; font-size:0.7rem; opacity:0.7;">(Haz clic para cambiar)</span>
         </div>
      </div>
    </div>
  `;

  // Initialize Visualizer
  const visualizerBox = document.getElementById("shao-yong-box");
  const hexData = Object.values(store.content.hexagrams); // Using hybrid data which has 'binary'
  new ShaoYongCircle(visualizerBox, hexData, {
    radius: 120,
    onHexClick: (id) => openHexagramDetail(id)
  });

  const btnStart = document.getElementById("btnStart");
  if (btnStart) {
    btnStart.onclick = () => {
      state.nav = "toss";
      state.draft.tosses = [];
      render();
    };
  }
}

function openHexagramDetail(id) {
  // Functional mock for browsing the 64 hexagrams
  const hex = buildReading([id])[0];
  state.session = {
    id: Date.now(),
    date: new Date().toISOString(),
    hexagrams: { primary: hex },
    lines: []
  };
  state.nav = "reading";
  render();
}

function TossView() {
  const n = state.draft.tosses.length;
  return `
    <div class="vstack" style="gap:30px;">
      <div class="sage-container">
         <div class="sage-avatar">
            ${SageAvatarHTML()}
         </div>
         <div class="sage-bubble">
            <span id="zenText"></span>
         </div>
      </div>

      <div class="card" style="text-align:center;">
        <div class="hstack" style="justify-content:center; margin-bottom:20px;">
           <span class="muted serif">Línea ${n + 1} de 6</span>
        </div>

        <div class="coin-stage" id="coinStage">
           ${renderStageCoins()}
        </div>

        <div class="divider"></div>

        <div class="hstack" style="justify-content:center; gap:20px;">
          <button class="btn btn--primary" id="btnToss" ${state._tossing ? "disabled" : ""} style="min-width:160px;">
            ${n < 6 ? t("toss.btn_toss") : t("toss.btn_finish")}
          </button>
          <button class="btn btn--ghost" id="btnBackHome" ${state._tossing ? "disabled" : ""}>Abandonar</button>
        </div>
      </div>

      <div class="row" style="justify-content:center;">
          ${renderHexLines(state.draft.tosses)}
      </div>
    </div>
  `;
}

function renderHexLines(tosses) {
  // Solo mostramos líneas acumuladas
  if (tosses.length === 0) return "";
  const items = tosses.map(t => `<div class="hex-line ${t.value % 2 === 0 ? 'yin' : 'yang'}"></div>`).reverse();
  return `<div class="hex-visual" style="padding:20px; gap:8px;">${items.join("")}</div>`;
}

function renderReading() {
  const s = state.session || buildReading(state.draft);
  if (!s) return "Error building reading";

  const p = s.hexagrams.primary;
  const r = s.hexagrams.resulting;
  const isMutating = !!r;

  return `
    <div class="vstack" style="gap:40px;">
      <section style="text-align:center;">
        <div class="seal" style="margin:0 auto; width:50px; height:50px;">${p.id}</div>
        <h2 class="hexTitle" style="margin-top:20px;">${escapeHtml(p.hanzi)} · ${escapeHtml(p.slug)}</h2>
        <p class="muted serif" style="font-size:1.1rem;">${escapeHtml(p.judgment_es)}</p>
      </section>

      <div class="card" style="background:var(--accent-soft);">
        <h3 class="serif" style="margin-top:0;">La Imagen</h3>
        <p class="serif">${escapeHtml(p.image_es)}</p>
      </div>

      <section>
         <h3 class="muted serif" style="text-transform:uppercase; font-size:0.8rem; letter-spacing:0.1em;">Estructura Trigramática</h3>
         <div class="row" style="gap:20px; margin-top:15px;">
            <div class="card" style="flex:1; padding:20px; text-align:center;">
               <div class="muted serif" style="font-size:0.7rem;">SUPERIOR</div>
               <div style="font-weight:600;">${escapeHtml(p.trigrams.upper.slug_es)}</div>
            </div>
            <div class="card" style="flex:1; padding:20px; text-align:center;">
               <div class="muted serif" style="font-size:0.7rem;">INFERIOR</div>
               <div style="font-weight:600;">${escapeHtml(p.trigrams.lower.slug_es)}</div>
            </div>
         </div>
      </section>

      ${renderLinesDetail(s)}
      ${renderResultingSection(isMutating, r)}
      ${state.readingMode !== 'zen' ? renderPremiumReading(p) : ''}
      ${state.readingMode === 'study' ? renderStudyReading(p) : ''}

      <div class="divider"></div>

      <div class="vstack" style="gap:15px;">
        <button class="btn btn--primary" id="btnSave" style="width:100%;">Guardar Reflexión</button>
        <div class="row" style="gap:15px;">
           <button class="btn btn--ghost" id="btnPDF" style="flex:1;">Exportar PDF</button>
           <button class="btn btn--ghost" id="btnClose" style="flex:1;">Nueva Consulta</button>
        </div>
      </div>
    </div>
  `;
}

function renderLinesDetail(sess) {
  const lines = sess.lines || [];
  const moving = lines.filter(l => l.isMoving);
  if (moving.length === 0) return "";

  return `
    <div class="divider"></div>
    <section>
      <h3 class="muted serif" style="text-transform:uppercase; font-size:0.8rem; letter-spacing:0.1em;">Líneas en Movimiento</h3>
      <div class="vstack" style="gap:20px; margin-top:20px;">
        ${moving.map(l => `
          <div class="card" style="padding:24px; border-left:4px solid var(--accent);">
            <div style="font-weight:600; margin-bottom:8px;">Línea ${l.pos} — ${l.value === 6 ? 'Seis' : 'Nueve'}</div>
            <p class="serif" style="margin:0; opacity:0.9;">${escapeHtml(l.text_es)}</p>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderResultingSection(isMutating, hex) {
  if (!isMutating || !hex) return "";

  return `
    <div class="divider"></div>
    <section>
      <h3 class="muted serif" style="text-transform:uppercase; font-size:0.8rem; letter-spacing:0.1em;">Hexagrama de Transformación</h3>
      <div class="card" style="margin-top:20px; display:flex; gap:30px; align-items:center;">
        <div class="seal" style="background:var(--indigo); flex-shrink:0;">${hex.id}</div>
        <div class="vstack" style="gap:4px;">
           <h4 style="margin:0; font-size:1.4rem;">${escapeHtml(hex.hanzi)} · ${escapeHtml(hex.slug)}</h4>
           <p class="muted serif" style="margin:0;">El destino final de esta mutación.</p>
        </div>
      </div>
    </section>
  `;
}

function renderPremiumReading(hex) {
  if (!hex) return "";
  const qs = Array.isArray(hex.guiding_questions_es) ? hex.guiding_questions_es : [];
  return `
    <div class="divider"></div>
    <div class="card" style="background:var(--text); color:var(--bg); border:none;">
      <h3 class="serif" style="color:var(--gold); margin-top:0;">Sabiduría Profunda</h3>
      <p class="serif" style="opacity:0.9;">${escapeHtml(hex.taoist_reading_es || "—")}</p>
      
      <h4 class="serif" style="color:var(--gold); margin-top:30px;">Preguntas de Poder</h4>
      <ul style="padding-left:20px; opacity:0.8;">
        ${qs.map(q => `<li>${escapeHtml(q)}</li>`).join("")}
      </ul>
      
      <h4 class="serif" style="color:var(--gold); margin-top:30px;">Micro-Acción Ritual</h4>
      <div class="callout" style="background:rgba(255,255,255,0.1); padding:20px; border-radius:12px;">
         ${escapeHtml(hex.micro_action_es || "—")}
      </div>
    </div>
  `;
}

function HistoryView() {
  const items = state.history.map((s) => {
    const p = s.hexagrams?.primary;
    return `
      <div class="card history-card" data-open="${escapeHtml(s.id)}" style="cursor:pointer; display:flex; align-items:center; gap:20px; padding:20px;">
        <div class="seal" style="width:40px; height:40px; font-size:16px; flex-shrink:0;">${p?.id || '!!'}</div>
        <div class="vstack" style="gap:2px; flex:1;">
          <div style="font-weight:600; font-size:1.1rem;">${escapeHtml(p?.slug || "Consulta")}</div>
          <div class="muted serif" style="font-size:0.8rem;">${escapeHtml(s.created_at_iso.split("T")[0])}</div>
        </div>
        <div class="muted" style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-style:italic;">
          "${escapeHtml(s.question?.text_es || "—")}"
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="vstack" style="gap:30px;">
      <div style="text-align:center;">
        <h2 class="hexTitle">Tu Bitácora de Cambios</h2>
        <p class="muted serif">Tus consultas anteriores para reflexionar sobre el camino recorrido.</p>
      </div>

      <div class="vstack" style="gap:16px;">
        ${state.history.length ? items : `<div class="card muted serif" style="text-align:center;">Aún no has guardado ninguna reflexión.</div>`}
      </div>

      <div class="hstack" style="justify-content:center; gap:16px;">
        <button class="btn btn--primary" id="btnBackHome2">Regresar</button>
        ${state.history.length ? `<button class="btn btn--ghost" id="btnClearHistory">Limpiar Todo</button>` : ""}
      </div>
    </div>
  `;
}

function BootErrorView() {
  return `
    <div class="vstack" style="align-items:center; text-align:center; gap:30px; padding:60px 0;">
      <div class="seal" style="background:var(--vermilion); width:64px; height:64px; font-size:32px;">!</div>
      <h2 class="hexTitle">Error de Conexión</h2>
      <p class="serif muted" style="max-width:400px;">
        No pudimos cargar los archivos necesarios para el oráculo. 
        Por favor, verifica tu conexión a internet.
      </p>
      <div class="card" style="background:var(--accent-soft); font-family:monospace; font-size:0.8rem;">
        ${state.boot.error}
        ${state.boot.missing.length ? `<br><br>Faltan: ${state.boot.missing.join(", ")}` : ""}
      </div>
      <button class="btn btn--primary" onclick="location.reload()">Reintentar Ritual</button>
    </div>
  `;
}

function opt(val, label) {
  return `<option value="${val}" ${state.draft.question.mode === val ? "selected" : ""}>${label}</option>`;
}

function renderStageCoins() {
  return [1, 2, 3].map(() => `
    <div class="coin-3d">
      <div class="coin-face coin-front">
        <img src="./assets/coin_yang.png" alt="Moneda Yang" decoding="async" loading="lazy">
      </div>
      <div class="coin-face coin-back">
        <img src="./assets/coin_yin.png" alt="Moneda Yin" decoding="async" loading="lazy">
      </div>
    </div>
  `).join('');
}

function SageAvatarHTML() {
  return `
    <img src="./assets/sage.png" alt="Avatar del sabio" decoding="async" loading="lazy" />
  `;
}

// ---------- Domain Logic ----------

function bindShellEvents() {
  document.getElementById("btnOpenBook")?.addEventListener("click", () => {
    state._bookOpen = true;
    render();
  });
}

function initPageEffects() {
  const zenEl = document.getElementById("zenText");
  if (zenEl) {
    sageTyper = new Typewriter(zenEl, { typingSpeed: 40 });
    const n = state.draft.tosses.length;
    let msg = "";
    if (n === 0) msg = "Silencia tus pensamientos... ¿Qué busca saber tu alma hoy? Lanza las monedas cuando sientas calma.";
    else if (n < 6) msg = `El oráculo escucha... Línea ${n + 1}. Concéntrate en tu pregunta.`;
    else msg = "El hexagrama está completo. El destino se revela.";

    sageTyper.type(msg);
  }

  // Tilt if cards present
  document.querySelectorAll(".card").forEach(c => new TiltCard(c));
}

function onTossNextLine() {
  if (state._tossing) return;
  const n = state.draft.tosses.length;
  if (n >= 6) {
    finishToss();
    return;
  }

  state._tossing = true;
  render();

  // Animation delay
  setTimeout(() => {
    const coinEls = document.querySelectorAll(".coin-3d");
    coinEls.forEach(el => el.classList.add("tossing"));

    setTimeout(() => {
      coinEls.forEach(el => el.classList.remove("tossing"));

      // Math
      const line = (state.divinationMethod === 'yarrow_stalks') ? tossYarrowLine() : tossLine();
      state.draft.tosses.push(line);

      // Orientation randomizer
      coinEls.forEach((el, idx) => {
        const isHeads = line.coins[idx] === 'heads';
        el.style.transform = isHeads ? `rotateY(0deg)` : `rotateY(180deg)`;
      });

      state._tossing = false;
      render();

      if (state.draft.tosses.length === 6) {
        document.getElementById("btnToss").innerText = t("toss.btn_finish");
      }
    }, 800);
  }, 50);
}

function finishToss() {
  try {
    const sess = buildReading(state.draft);
    state.session = sess;
    state.session.id = cryptoRandomId();
    nav("reading");
    trackEvent("reading_viewed", { hex_id: sess.hexagrams.primary.id });
  } catch (e) {
    console.error("Finish toss fail", e);
  }
}

function bindPageEvents(root) {
  if (!root) return;

  // Home
  root.querySelector("#btnBegin")?.addEventListener("click", () => {
    if (!state.draft.question.text_es.trim()) {
      openModal(t("home.error_empty_question"), `<p>${t("home.error_empty_question_body")}</p>`);
      return;
    }
    beginToss();
  });
  root.querySelector("#qText")?.addEventListener("input", e => state.draft.question.text_es = e.target.value);
  root.querySelector("#qMode")?.addEventListener("change", e => state.draft.question.mode = e.target.value);

  // Toss
  root.querySelector("#btnToss")?.addEventListener("click", onTossNextLine);
  root.querySelector("#btnBackHome")?.addEventListener("click", startNew);

  // Reading
  root.querySelector("#btnSave")?.addEventListener("click", saveSession);
  root.querySelector("#btnPDF")?.addEventListener("click", exportPDF);
  root.querySelector("#btnClose")?.addEventListener("click", startNew);
  // History
  root.querySelector("#btnBackHome2")?.addEventListener("click", startNew);
  root.querySelector("#btnClearHistory")?.addEventListener("click", deleteHistory);

  root.querySelectorAll("[data-open]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-open");
      const sess = state.history.find(s => s.id === id);
      if (sess) { state.session = sess; nav("reading"); }
    });
  });

}

// ---------- Helpers ----------

const LS_KEY = "iching_sessions_v1";
const LS_THEME = "iching_theme_v1";

function escapeHtml(unsafe) {
  if (typeof unsafe !== "string") return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function cryptoRandomId() {
  return "sess_" + Math.random().toString(36).substr(2, 9);
}

function openModal(title, content) {
  const m = document.getElementById("modal");
  const tVal = document.getElementById("modalTitle");
  const bVal = document.getElementById("modalBody");

  if (m && tVal && bVal) {
    tVal.innerText = title;
    bVal.innerHTML = content;
    m.showModal();
  }
}
