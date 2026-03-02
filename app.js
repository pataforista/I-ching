import { BubbleMenu, Typewriter, InkGalaxy, TiltCard, EnsoLoader, DynamicHexagram, drawHanzi, DynamicAvatar } from "./ui-lib.js";
import { FoxAvatarController } from "./src/avatar/avatar-controller.js";
import {
  initEngine,
  trackEvent,
  tossLine,
  buildReading,
  t
} from "./engine.js";

// Constants
const LS_KEY = "iching_local_v1";
const LS_THEME = "iching_theme_v1";

function dispatchFox(eventName, payload) {
  document.dispatchEvent(new CustomEvent('fox_event', { detail: { eventName, payload } }));
}

// Constants
const CHUNK_DIR = "./data/content/";

// Global UI Instances
let sageTyper = null;
let bubbleMenu = null;
let galaxy = null;
let homeAvatar = null;
let tossAvatar = null;

var state = {
  // Boot status
  boot: { ok: true, missing: [], error: null },

  // Navigation: 'home' | 'toss' | 'reading' | 'history'
  nav: "home",

  // Data
  history: [],

  // Current Session Draft
  draft: {
    question: { text_es: "", mode: "reflexion" },
    tosses: [],
    tossMode: "digital",     // 'digital' | 'manual'
    manualCoins: ["heads", "heads", "heads"]  // current manual selection
  },

  // Active Session (Displaying Reading)
  session: null,

  // UI State
  _tossing: false,

  // Entitlements: app is fully paid — all features unlocked
  entitlements: {
    unlimited_history: true,
    premium_sections: true,
    pdf_export: true,
    full_access: true,
    journal_mode: true,
    export_tools: true
  }
};

// ---------- Init ----------
(async function init() {
  loadLocal();
  if (!state.history) state.history = [];

  initBubbleMenu();

  // Init Smooth Scroll (Lenis)
  if (window.Lenis) {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      smoothTouch: false,
      touchMultiplier: 2,
      infinite: false,
    });
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  }

  // Init Grain (Paper Texture) - Very subtle for Matte feel
  if (window.grained) {
    grained("body", {
      animate: true,
      patternWidth: 100,
      patternHeight: 100,
      grainOpacity: 0.02, /* Reduced from 0.04 */
      grainDensity: 1.0,
      grainWidth: 1.0,
      grainHeight: 1.0,
      grainChaos: 0.2,
      grainSpeed: 10
    });
  }

  // Init Ink Galaxy Background - Reduced distraction for Warm Minimalism
  galaxy = new InkGalaxy({ count: 40 }); /* Reduced from 160 */

  try {
    await initEngine();
    state.boot.ok = true;
    trackEvent("session_start");
  } catch (e) {
    state.boot.ok = false;
    state.boot.error = String(e?.message || e);
    if (e.missing && Array.isArray(e.missing)) {
      state.boot.missing = e.missing;
    }
  }

  registerSW();
  render();
})();

function initBubbleMenu() {
  bubbleMenu = new BubbleMenu({
    items: [
      { id: "home", icon: "⊕", label: t("menu.home") || "Nueva consulta", onClick: () => startNew() },
      { id: "history", icon: "◉", label: t("menu.history") || "Historial", onClick: () => openHistory() },
      { id: "theme", icon: "◐", label: t("menu.theme") || "Tema", onClick: () => onToggleTheme() },
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
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "ink" ? "paper" : "ink";
  applyTheme(next);
}

function applyTheme(name) {
  document.documentElement.setAttribute("data-theme", name);
  localStorage.setItem(LS_THEME, name);
}

// ---------- SW ----------
async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('./sw.js');
  } catch { /* silent */ }
}

// ---------- Navigation ----------
async function nav(to) {
  const overlay = document.createElement("div");
  overlay.className = "ink-transition-overlay";
  document.body.appendChild(overlay);

  requestAnimationFrame(() => overlay.classList.add("active"));
  await new Promise(r => setTimeout(r, 800));

  state.nav = to;
  render();

  if (to === "home") dispatchFox('OPEN_SCREEN');
  else if (to === "toss") dispatchFox('SHOW_ORACLE');
  else if (to === "reading") dispatchFox('SHOW_READING');
  else if (to === "history") dispatchFox('SLEEP_MODE');

  overlay.classList.remove("active");
  overlay.classList.add("fade-out");
  setTimeout(() => overlay.remove(), 600);
}

// ---------- Actions ----------
function startNew() {
  state.draft = { question: { text_es: "", mode: "reflexion" }, tosses: [] };
  state.session = null;
  nav("home");
}

function beginToss() {
  dispatchFox('START_SESSION');
  state.draft.tosses = [];
  state.session = null;
  nav("toss");
}

function saveSession() {
  if (!state.session) return;
  trackEvent("session_saved");
  state.history.unshift(state.session);
  state.history = state.history.slice(0, 200);
  saveLocal();
  openModal("Guardado", `<p style="font-family:var(--font-serif);">Tu reflexión ha sido guardada en el diario.</p>`);
  render();
}

function openHistory() {
  nav("history");
}

function deleteHistory() {
  state.history = [];
  saveLocal();
  openModal("Historial borrado", `<p style="font-family:var(--font-serif);">No queda nada guardado en este dispositivo.</p>`);
  render();
}

function exportPDF() {
  window.print();
}

// ---------- Render ----------
function render() {
  const root = document.getElementById("app");
  if (!root) return;

  if (!state.boot.ok) {
    root.innerHTML = `<div class="immersive-shell"><div class="immersive-screen">${BootErrorView()}</div></div>`;
    return;
  }

  let contentHTML = "";
  switch (state.nav) {
    case "home": contentHTML = HomeFormView(); break;
    case "toss": contentHTML = TossView(); break;
    case "reading": contentHTML = ReadingView(); break;
    case "history": contentHTML = HistoryView(); break;
    default: contentHTML = HomeFormView();
  }

  root.innerHTML = `<div class="immersive-shell fade-in">${contentHTML}</div>`;

  bindPageEvents(root);
  initPageEffects();
  renderDynamicVisuals();
}

function renderDynamicVisuals() {
  // Home Avatar
  const homeTarget = document.getElementById("homeAvatarTarget");
  if (homeTarget) {
    if (homeAvatar) homeAvatar.destroy();
    homeAvatar = new FoxAvatarController(homeTarget);
  } else if (homeAvatar) {
    homeAvatar.destroy();
    homeAvatar = null;
  }

  // Toss Avatar
  const tossTarget = document.getElementById("tossAvatarTarget");
  if (tossTarget) {
    if (tossAvatar) tossAvatar.destroy();
    tossAvatar = new FoxAvatarController(tossTarget);
  } else if (tossAvatar) {
    tossAvatar.destroy();
    tossAvatar = null;
  }

  // Reading: setup IntersectionObserver for reveal animations
  if (state.nav === "reading") {
    initRevealObserver();
    initReadingVisuals();
  }
}

function initRevealObserver() {
  const sections = document.querySelectorAll('.reveal-section');
  if (!sections.length) return;

  // Immediately show first two sections
  sections.forEach((el, i) => {
    if (i < 2) el.classList.add('visible');
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

  sections.forEach(el => {
    if (!el.classList.contains('visible')) observer.observe(el);
  });
}

function initReadingVisuals() {
  const sess = state.session;
  if (!sess) return;
  const p = sess.hexagrams?.primary;
  const r = sess.hexagrams?.resulting;

  const hexContainer = document.getElementById('primaryHexSVG');
  if (hexContainer && p?.lines) new DynamicHexagram(p.lines).render(hexContainer);

  const hanziContainer = document.getElementById('hanziAnimation');
  if (hanziContainer && p?.hanzi) drawHanzi(hanziContainer, p.hanzi, 100);

  const resContainer = document.getElementById('resultingHexSVG');
  if (resContainer && r?.lines) new DynamicHexagram(r.lines).render(resContainer);
}

const isMutating = !!r;
const movingLines = (sess.lines || []).filter(l => l.isMoving);

// Helper: format hexagram title
const hexTitle = (hex) => `${hex.hanzi} · ${hex.slug.charAt(0).toUpperCase() + hex.slug.slice(1)}`;

// --- Page 1: Revelación ---
const primaryJudgment = p.dynamic_core_es || "—";
book.addPage(`
    <div class="vstack" style="align-items:center; text-align:center; gap:20px;">
        <div class="reading-meta">
          <span class="seal" style="width:32px; height:32px; font-size:12px; display:inline-grid;">${p.id}</span>
          <span class="muted serif" style="font-size:0.75rem; margin-left:10px; text-transform:uppercase; letter-spacing:0.1em;">${p.name_en_standard || ''}</span>
        </div>
        <div id="hanziAnimation" style="min-height:120px; display:grid; place-items:center;"></div>
        <div id="primaryHexSVG" style="margin: 8px auto; display:grid; place-items:center; color:var(--text);"></div>
        <h2 class="hexTitle" style="margin:0;">${escapeHtml(hexTitle(p))}</h2>
        <div class="reading-judgment">
            <p class="serif" style="font-size:1.05rem; line-height:1.7; opacity:0.85; max-width:480px; margin:0 auto;">${escapeHtml(primaryJudgment)}</p>
        </div>
        ${sess.question?.text_es ? `
        <div class="reading-question-echo">
          <span class="muted serif" style="font-size:0.8rem; font-style:italic;">"${escapeHtml(sess.question.text_es)}"</span>
        </div>` : ''}
    </div>
  `, "--left");

// --- Page 2: Imagen y Estructura ---
book.addPage(`
    <div class="vstack" style="gap:20px;">
        <div class="callout">
            <h3 class="serif" style="margin:0 0 10px; color:var(--accent); font-size:1rem; text-transform:uppercase; letter-spacing:0.08em;">La Imagen</h3>
            <p class="serif" style="font-size:1.05rem; opacity:0.9; margin:0; font-style:italic;">${escapeHtml(p.image_es || '—')}</p>
        </div>
        <div class="card" style="padding:20px;">
            <h3 class="serif" style="margin:0 0 12px; color:var(--accent); font-size:0.9rem; text-transform:uppercase; letter-spacing:0.08em;">Lectura General</h3>
            <p class="serif" style="opacity:0.9; margin:0; font-size:0.95rem; line-height:1.8;">${escapeHtml(p.general_reading_es || '—')}</p>
        </div>
        <div style="margin-top:4px;">
          <h3 class="muted serif" style="text-transform:uppercase; font-size:0.75rem; letter-spacing:0.1em; margin:0 0 12px;">Estructura Trigramática</h3>
          <div class="row" style="gap:16px;">
              <div class="card" style="flex:1; padding:16px; text-align:center; gap:8px;">
                  <div class="muted serif" style="font-size:0.7rem; text-transform:uppercase; letter-spacing:0.08em;">Superior</div>
                  <div style="font-size:1.8rem; line-height:1;">${p.trigrams?.upper?.symbol_unicode || ''}</div>
                  <div style="font-weight:600; font-size:0.9rem;">${escapeHtml(p.trigrams?.upper?.name_es || p.upper_trigram || '—')}</div>
                  <div class="muted serif" style="font-size:0.7rem;">${escapeHtml((p.trigrams?.upper?.keywords_es || []).slice(0, 2).join(' · '))}</div>
              </div>
              <div class="card" style="flex:1; padding:16px; text-align:center; gap:8px;">
                  <div class="muted serif" style="font-size:0.7rem; text-transform:uppercase; letter-spacing:0.08em;">Inferior</div>
                  <div style="font-size:1.8rem; line-height:1;">${p.trigrams?.lower?.symbol_unicode || ''}</div>
                  <div style="font-weight:600; font-size:0.9rem;">${escapeHtml(p.trigrams?.lower?.name_es || p.lower_trigram || '—')}</div>
                  <div class="muted serif" style="font-size:0.7rem;">${escapeHtml((p.trigrams?.lower?.keywords_es || []).slice(0, 2).join(' · '))}</div>
              </div>
          </div>
        </div>
    </div>
  `, "--right");

// --- Page 3: Líneas en Movimiento (si las hay) ---
if (movingLines.length > 0) {
  book.addPage(`
        <div class="vstack" style="gap:16px;">
            <div>
              <h3 class="serif" style="color:var(--accent); margin:0 0 4px; font-size:1.1rem;">Líneas en Movimiento</h3>
              <p class="muted serif" style="font-size:0.8rem; margin:0;">Las líneas que mutan transforman el hexagrama.</p>
            </div>
            <div class="vstack" style="gap:14px;">
              ${movingLines.map(l => `
                <div class="card" style="padding:16px; border-left:4px solid var(--accent); gap:8px;">
                  <div class="hstack" style="gap:10px; margin-bottom:6px;">
                    <div class="seal" style="width:28px; height:28px; font-size:11px; flex-shrink:0;">${l.pos}</div>
                    <div style="font-weight:600; font-size:0.95rem;">Línea ${l.pos} — ${l.value === 6 ? 'Seis (Yin Móvil)' : 'Nueve (Yang Móvil)'}</div>
                  </div>
                  <p class="serif" style="margin:0; opacity:0.88; font-size:0.9rem; line-height:1.75;">${escapeHtml(l.text_es || '—')}</p>
                </div>
              `).join("")}
            </div>
        </div>
      `, "--left");
}

// --- Page 4: Transformación o Preguntas de Poder ---
if (isMutating && r) {
  book.addPage(`
        <div class="vstack" style="gap:18px;">
          <div>
            <h3 class="serif" style="color:var(--accent); margin:0 0 4px; font-size:1.1rem;">Hexagrama de Transformación</h3>
            <p class="muted serif" style="font-size:0.8rem; margin:0;">Hacia dónde apunta la mutación.</p>
          </div>
          <div class="card" style="display:flex; gap:20px; align-items:center; padding:20px;">
              <div id="resultingHexSVG" style="flex-shrink:0; color:var(--accent);"></div>
              <div class="vstack" style="gap:6px; flex:1;">
                 <h4 style="margin:0; font-size:1.15rem;">${escapeHtml(hexTitle(r))}</h4>
                 <p class="muted serif" style="margin:0; font-size:0.8rem;">${escapeHtml(r.name_en_standard || '')}</p>
                 <p class="serif" style="margin:0; font-size:0.88rem; opacity:0.82; line-height:1.6;">${escapeHtml((r.dynamic_core_es || '').substring(0, 130))}…</p>
              </div>
          </div>
          <div class="divider"></div>
          <h4 class="serif" style="color:var(--accent); margin:0;">Preguntas de Reflexión</h4>
          <ul class="serif" style="padding-left:20px; opacity:0.85; margin:0; display:flex; flex-direction:column; gap:10px; font-size:0.92rem; line-height:1.7;">
              ${(p.guiding_questions_es || []).map(q => `<li>${escapeHtml(q)}</li>`).join("")}
          </ul>
        </div>
      `, "--right");
} else {
  book.addPage(`
        <div class="vstack" style="gap:18px;">
          <div>
            <h4 class="serif" style="color:var(--accent); margin:0 0 4px; font-size:1.1rem;">Preguntas de Reflexión</h4>
            <p class="muted serif" style="font-size:0.8rem; margin:0;">Para profundizar en la consulta.</p>
          </div>
          <ul class="serif" style="padding-left:20px; opacity:0.85; margin:0; display:flex; flex-direction:column; gap:12px; font-size:0.95rem; line-height:1.75;">
              ${(p.guiding_questions_es || []).map(q => `<li>${escapeHtml(q)}</li>`).join("")}
          </ul>
        </div>
      `, "--right");
}

// --- Page 5: Sabiduría Profunda y Acciones ---
book.addPage(`
    <div class="vstack" style="gap:18px;">
        <div>
          <h3 class="serif" style="color:var(--accent); margin:0 0 4px; font-size:1.1rem;">Perspectiva Taoísta</h3>
          <p class="muted serif" style="font-size:0.8rem; margin:0;">Wu wei y flujo natural.</p>
        </div>
        <p class="serif" style="opacity:0.9; margin:0; font-size:0.95rem; line-height:1.8;">${escapeHtml(p.taoist_reading_es || "—")}</p>

        <div class="callout" style="margin-top:4px;">
            <h4 class="serif" style="margin:0 0 8px; color:var(--accent); font-size:0.9rem; text-transform:uppercase; letter-spacing:0.06em;">Micro-Acción Ritual</h4>
            <p class="serif" style="margin:0; font-size:0.92rem; line-height:1.7;">${escapeHtml(p.micro_action_es || "—")}</p>
        </div>

        <div class="divider"></div>

        <div class="vstack" style="gap:10px;">
            <button class="btn btn--primary" id="btnSave" style="width:100%; font-size:1rem;">Guardar en el Diario</button>
            <div class="row" style="gap:10px; justify-content:center;">
               <button class="btn btn--ghost" id="btnPDF" style="flex:1; font-size:0.85rem;">Exportar PDF</button>
               <button class="btn btn--ghost" id="btnClose" style="flex:1; font-size:0.85rem;">Nueva Consulta</button>
            </div>
        </div>

        ${p.ethics_note_es ? `
        <p class="muted serif" style="font-size:0.72rem; opacity:0.5; text-align:center; margin:0; line-height:1.5;">${escapeHtml(p.ethics_note_es)}</p>
        ` : ''}
    </div>
  `, book.pages.length % 2 === 0 ? "--left" : "--right");

book.render();

// Render visual components after book DOM is created
const hexContainer = document.getElementById("primaryHexSVG");
if (hexContainer && p.lines) {
  new DynamicHexagram(p.lines).render(hexContainer);
}

const hanziContainer = document.getElementById("hanziAnimation");
if (hanziContainer && p.hanzi) {
  drawHanzi(hanziContainer, p.hanzi, 110);
}

// No book shell — views render directly into immersive-shell

function HomeFormView() {
  return `
    <div class="immersive-screen screen-home">
      <div class="home-hero">

        <div id="homeAvatarTarget" style="width: clamp(160px, 20vw, 220px); height: clamp(160px, 20vw, 220px); position: relative; z-index: 10;"></div>

        <div class="home-brand">
          <span class="home-brand-glyph">易</span>
          <p class="home-brand-title">I Ching · El Libro de las Mutaciones</p>
        </div>

        <div class="home-form-card">
          <div class="vstack" style="gap:16px;">
            <div class="vstack" style="gap:8px;">
              <label class="muted serif" style="font-size:0.8rem; text-transform:uppercase; letter-spacing:0.08em;">${t("home.label_focus") || "Foco"}</label>
              <select id="qMode" class="input-field">
                ${opt("reflexion", t("home.focus_options.reflexion") || "Reflexión general")}
                ${opt("decision", t("home.focus_options.decision") || "Toma de decisión")}
                ${opt("relacion", t("home.focus_options.relacion") || "Vínculos y relaciones")}
                ${opt("trabajo", t("home.focus_options.trabajo") || "Trabajo y proyectos")}
                ${opt("salud", t("home.focus_options.salud") || "Bienestar y salud")}
                ${opt("otro", t("home.focus_options.otro") || "Otro")}
              </select>
            </div>

            <div class="vstack" style="gap:8px;">
              <label class="muted serif" style="font-size:0.8rem; text-transform:uppercase; letter-spacing:0.08em;">${t("home.label_question") || "Tu Pregunta"}</label>
              <textarea id="qText" class="input-field" style="min-height:110px; resize:none;" placeholder="${t("home.placeholder_question") || "¿Qué actitud conviene sostener ante esta situación?"}">\${escapeHtml(state.draft.question.text_es || "")}</textarea>
            </div>

            <button class="btn btn--primary" id="btnBegin" style="width:100%; padding:18px; font-size:1.05rem; margin-top:4px;">
              ${t("home.btn_toss") || "Consultar el Oráculo"}
            </button>
          </div>
        </div>

        ${state.history.length > 0 ? `
        <button class="btn btn--ghost" id="btnHistoryShortcut" style="font-size:0.85rem; opacity:0.7;">Ver historial (${state.history.length})</button>
        ` : ''}

      </div>
    </div>
  `;
}

function TossView() {
  const n = state.draft.tosses.length;
  const isComplete = n >= 6;
  const isManual = state.draft.tossMode === 'manual';

  const coinLabel = (face) => face === 'heads'
    ? `<span style="font-size:2rem;line-height:1">☰</span><div style="font-size:0.68rem;text-transform:uppercase;letter-spacing:0.08em;margin-top:4px;opacity:0.7;">Yang</div>`
    : `<span style="font-size:2rem;line-height:1">☷</span><div style="font-size:0.68rem;text-transform:uppercase;letter-spacing:0.08em;margin-top:4px;opacity:0.7;">Yin</div>`;

  const manualCoinsHTML = state.draft.manualCoins.map((face, i) => `
    <button
      class="manual-coin-btn ${face === 'heads' ? 'yang' : 'yin'}"
      id="manualCoin${i}"
      data-idx="${i}"
      title="Clic para cambiar"
    >
      ${coinLabel(face)}
    </button>
  `).join('');

  return `
    <div class="immersive-screen screen-toss">
      <div class="toss-ritual">

        <div id="tossAvatarTarget" style="width: clamp(110px, 15vw, 160px); height: clamp(110px, 15vw, 160px); position: relative;"></div>

        <!-- Mode toggle -->
        ${!isComplete ? `
        <div class="toss-mode-toggle">
          <button class="toss-mode-btn ${!isManual ? 'active' : ''}" id="btnModeDigital">Digital</button>
          <button class="toss-mode-btn ${isManual ? 'active' : ''}" id="btnModeManual">Física</button>
        </div>
        ` : ''}

        <div style="text-align:center; display:flex; flex-direction:column; gap:4px;">
          <span class="muted serif" style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.12em; opacity:0.5;">
            ${isComplete ? 'Hexagrama completo' : `Línea ${n + 1} de 6`}
          </span>
          <div class="toss-oracle-text">
            ${isManual && !isComplete
      ? '<em style="opacity:0.55">Lanza las monedas físicamente, luego registra: ☰ Yang (cara) · ☷ Yin (cruz)</em>'
      : '<span id="zenText"></span>'}
          </div>
        </div>

        ${isManual && !isComplete ? `
        <!-- Manual coin selectors -->
        <div class="manual-coins-row">
          ${manualCoinsHTML}
        </div>
        <div style="text-align:center; opacity:0.45; font-family:var(--font-serif); font-size:0.78rem;">
          Suma: ${state.draft.manualCoins.reduce((s, f) => s + (f === 'heads' ? 3 : 2), 0)}
          · Toca cada moneda para cambiarla
        </div>
        ` : `
        <!-- Digital animated coins -->
        <div class="coin-stage" id="coinStage">
          ${renderStageCoins()}
        </div>
        <div id="ensoTarget" style="min-height:20px;"></div>
        `}

        <div class="toss-actions" style="width:100%; max-width:320px;">
          ${isComplete ? `
            <button class="btn btn--primary" id="btnFinish" style="width:100%; padding:18px; font-size:1.1rem;">
              Revelar la Lectura
            </button>
          ` : isManual ? `
            <button class="btn btn--primary" id="btnManualConfirm" style="width:100%; padding:18px; font-size:1.1rem;">
              Confirmar Línea ${n + 1}
            </button>
          ` : `
            <button class="btn btn--primary" id="btnToss" ${state._tossing ? 'disabled' : ''} style="width:100%; padding:18px; font-size:1.1rem;">
              ${t('toss.btn_toss') || 'Lanzar Monedas'}
            </button>
          `}
          <button class="btn btn--ghost" id="btnBackHome" ${state._tossing ? 'disabled' : ''} style="font-size:0.85rem; opacity:0.6;">Abandonar</button>
        </div>

        ${n > 0 ? `
        <div class="hex-accumulator">
          <div class="muted serif" style="font-size:0.65rem; text-transform:uppercase; letter-spacing:0.12em; margin-bottom:10px; text-align:center; opacity:0.5;">Hexagrama en formación</div>
          ${renderHexLines(state.draft.tosses)}
        </div>
        ` : ''}

      </div>
    </div>
  `;
}

function renderHexLines(tosses) {
  if (tosses.length === 0) return "";

  const w = 120, sw = 9, lineGap = 14;
  const breakGap = 20;
  const segW = (w - breakGap) / 2;
  const totalLines = 6;
  const totalH = totalLines * sw + (totalLines - 1) * lineGap;
  const uid = Math.random().toString(36).slice(2, 7);

  // Build a 6-slot array: filled tosses (bottom→top) + empty placeholders
  const slots = Array(6).fill(null);
  tosses.forEach((toss, i) => { slots[i] = toss; });

  const wavyPath = (x1, x2, yc, seed) => {
    const wobble = (((seed * 7919) % 5) - 2) * 0.4;
    return `M ${x1} ${yc} Q ${x1 + (x2 - x1) * 0.5} ${yc + wobble} ${x2} ${yc}`;
  };

  const animCSS = `@keyframes hx-${uid}{from{stroke-dashoffset:var(--dl);opacity:0.2;}to{stroke-dashoffset:0;opacity:1;}}`;

  // Render bottom-to-top display (slot[0] = line 1 = bottom)
  // But visually reverse: slot[5] = top of SVG
  let paths = '';
  for (let visualIdx = 0; visualIdx < 6; visualIdx++) {
    const slotIdx = 5 - visualIdx; // top visual = highest toss index
    const toss = slots[slotIdx];
    const yc = visualIdx * (sw + lineGap) + sw / 2;
    const seed = slotIdx * 17 + visualIdx * 3;
    const isNew = slotIdx === tosses.length - 1; // most recently added

    if (toss === null) {
      // Placeholder — ghost line
      const d = wavyPath(0, w, yc, seed);
      paths += `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" opacity="0.08"/>`;
      continue;
    }

    const val = toss.value || 7;
    const isYang = val % 2 !== 0;
    const isMoving = toss.is_moving;
    const delay = isNew ? '0s' : '0s';
    const dur = isNew ? '0.5s' : '0.01s';

    const stk = (len, d, extraDelay = 0) =>
      `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round"
        style="stroke-dasharray:${len};--dl:${len};stroke-dashoffset:${len};animation:hx-${uid} ${dur} cubic-bezier(.25,.1,.3,1) ${delay} forwards;" opacity="0"/>`;

    if (isYang) {
      paths += stk(w, wavyPath(0, w, yc, seed));
    } else {
      paths += stk(segW, wavyPath(0, segW, yc, seed));
      paths += stk(segW, wavyPath(w - segW, w, yc, seed + 31));
    }

    if (isMoving) {
      paths += `<circle cx="${w / 2}" cy="${yc}" r="${sw * 0.35}" fill="hsl(38,80%,58%)" opacity="0.9"/>`;
    }
  }

  return `
    <svg width="${w}" height="${totalH}" viewBox="0 0 ${w} ${totalH}" style="display:block;overflow:visible;">
      <defs><style>${animCSS}</style></defs>
      ${paths}
    </svg>`;
}


function ReadingView() {
  if (!state.session) {
    return `<div class="immersive-screen"><p class="serif muted">Sin sesión activa.</p></div>`;
  }

  const p = state.session.hexagrams?.primary;
  const r = state.session.hexagrams?.resulting;
  if (!p) return `<div class="immersive-screen"><p class="serif muted">No se pudo cargar la lectura.</p></div>`;

  const movingLines = (state.session.lines || []).filter(l => l.isMoving);
  const hexTitle = `${p.hanzi || ''} · ${p.slug ? p.slug.charAt(0).toUpperCase() + p.slug.slice(1) : ''}`.trim();
  const hexTitleR = r ? `${r.hanzi || ''} · ${r.slug ? r.slug.charAt(0).toUpperCase() + r.slug.slice(1) : ''}`.trim() : '';

  return `
    <div class="immersive-screen screen-reading">

      <!-- Sticky frosted-glass header -->
      <div class="reading-sticky-header">
        <div class="reading-sticky-hex-name">
          <span class="reading-sticky-glyph">${p.hanzi || '☰'}</span>
          <span>${escapeHtml(hexTitle)}</span>
        </div>
        <div class="hstack" style="gap:10px; flex-shrink:0;">
          <button class="btn btn--ghost" id="btnSave" style="padding:8px 16px; font-size:0.82rem;">Guardar</button>
          <button class="btn btn--ghost" id="btnClose" style="padding:8px 16px; font-size:0.82rem;">Nueva</button>
        </div>
      </div>

      <!-- Scrollable revelation content -->
      <div class="reading-content">

        <!-- Hero: hanzi + hexagram -->
        <div class="reveal-section reading-hero">
          <div id="hanziAnimation" style="min-height:100px; display:grid; place-items:center;"></div>
          <div id="primaryHexSVG" style="display:grid; place-items:center; color:var(--text);"></div>
          <h1 class="hexTitle" style="font-size:clamp(1.6rem,5vw,2.4rem); margin:0;">${escapeHtml(hexTitle)}</h1>
          <p class="muted serif" style="font-size:0.85rem; margin:0;">${escapeHtml(p.name_en_standard || '')}</p>
          ${state.session.question?.text_es ? `
          <div class="reading-question-echo">"${escapeHtml(state.session.question.text_es)}"</div>
          ` : ''}
        </div>

        <div class="reading-divider"></div>

        <!-- Juicio central -->
        <div class="reveal-section">
          <span class="reading-section-label">El Oráculo Habla</span>
          <div class="callout" style="text-align:center;">
            <p class="serif" style="font-size:1.1rem; line-height:1.8; margin:0; opacity:0.9;">${escapeHtml(p.dynamic_core_es || '—')}</p>
          </div>
        </div>

        <!-- Imagen -->
        <div class="reveal-section">
          <span class="reading-section-label">La Imagen</span>
          <p class="serif" style="font-size:1.05rem; font-style:italic; opacity:0.85; line-height:1.8; margin:0;">${escapeHtml(p.image_es || '—')}</p>
        </div>

        <!-- Lectura general -->
        <div class="reveal-section">
          <span class="reading-section-label">Lectura General</span>
          <p class="serif" style="opacity:0.88; margin:0; line-height:1.85; font-size:0.97rem;">${escapeHtml(p.general_reading_es || '—')}</p>
        </div>

        <!-- Líneas en movimiento -->
        ${movingLines.length > 0 ? `
        <div class="reveal-section">
          <span class="reading-section-label">Líneas en Movimiento</span>
          <div class="vstack" style="gap:16px;">
            ${movingLines.map(l => `
              <div class="card" style="border-left:3px solid var(--accent); padding:18px 22px;">
                <div style="font-weight:600; font-size:0.9rem; margin-bottom:6px; opacity:0.7;">Línea ${l.pos} — ${l.value === 6 ? 'Seis (Yin Móvil)' : 'Nueve (Yang Móvil)'}</div>
                <p class="serif" style="margin:0; opacity:0.88; font-size:0.92rem; line-height:1.75;">${escapeHtml(l.text_es || '—')}</p>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <!-- Estructuras trigramáticas -->
        <div class="reveal-section">
          <span class="reading-section-label">Estructura Trigramática</span>
          <div class="row" style="gap:14px;">
            <div class="card" style="flex:1; padding:18px; text-align:center; gap:8px;">
              <div class="muted serif" style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.08em;">Superior</div>
              <div style="font-size:1.8rem; line-height:1;">${p.trigrams?.upper?.symbol_unicode || ''}</div>
              <div style="font-weight:600; font-size:0.9rem;">${escapeHtml(p.trigrams?.upper?.name_es || p.upper_trigram || '—')}</div>
              <div class="muted serif" style="font-size:0.7rem;">${escapeHtml((p.trigrams?.upper?.keywords_es || []).slice(0, 2).join(' · '))}</div>
            </div>
            <div class="card" style="flex:1; padding:18px; text-align:center; gap:8px;">
              <div class="muted serif" style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.08em;">Inferior</div>
              <div style="font-size:1.8rem; line-height:1;">${p.trigrams?.lower?.symbol_unicode || ''}</div>
              <div style="font-weight:600; font-size:0.9rem;">${escapeHtml(p.trigrams?.lower?.name_es || p.lower_trigram || '—')}</div>
              <div class="muted serif" style="font-size:0.7rem;">${escapeHtml((p.trigrams?.lower?.keywords_es || []).slice(0, 2).join(' · '))}</div>
            </div>
          </div>
        </div>

        <!-- Transformación -->
        ${r ? `
        <div class="reveal-section">
          <span class="reading-section-label">Hexagrama de Transformación</span>
          <div class="card" style="display:flex; gap:20px; align-items:center; padding:22px;">
            <div id="resultingHexSVG" style="flex-shrink:0; color:var(--accent);"></div>
            <div class="vstack" style="gap:6px; flex:1;">
              <h4 style="margin:0; font-size:1.05rem;">${escapeHtml(hexTitleR)}</h4>
              <p class="muted serif" style="margin:0; font-size:0.8rem;">${escapeHtml(r.name_en_standard || '')}</p>
              <p class="serif" style="margin:0; font-size:0.88rem; opacity:0.8; line-height:1.6;">${escapeHtml((r.dynamic_core_es || '').substring(0, 150))}…</p>
            </div>
          </div>
        </div>
        ` : ''}

        <!-- Perspectiva taoísta -->
        <div class="reveal-section">
          <span class="reading-section-label">Perspectiva Taoísta</span>
          <p class="serif" style="opacity:0.88; margin:0; line-height:1.85; font-size:0.97rem;">${escapeHtml(p.taoist_reading_es || '—')}</p>
        </div>

        <!-- Preguntas de reflexión  -->
        ${(p.guiding_questions_es || []).length ? `
        <div class="reveal-section">
          <span class="reading-section-label">Preguntas de Reflexión</span>
          <ul class="serif" style="padding-left:20px; opacity:0.85; margin:0; display:flex; flex-direction:column; gap:12px; font-size:0.95rem; line-height:1.75;">
            ${(p.guiding_questions_es || []).map(q => `<li>${escapeHtml(q)}</li>`).join('')}
          </ul>
        </div>
        ` : ''}

        <!-- Micro-acción -->
        ${p.micro_action_es ? `
        <div class="reveal-section">
          <div class="callout">
            <span class="reading-section-label" style="margin-bottom:8px;">Micro-Acción Ritual</span>
            <p class="serif" style="margin:0; font-size:0.95rem; line-height:1.75;">${escapeHtml(p.micro_action_es)}</p>
          </div>
        </div>
        ` : ''}

        <!-- Acciones finales -->
        <div class="reveal-section">
          <div class="vstack" style="gap:12px; align-items:center;">
            <div class="reading-divider"></div>
            <div class="row" style="gap:10px; justify-content:center; flex-wrap:wrap;">
              <button class="btn btn--primary" id="btnSave2" style="padding:14px 32px;">Guardar en el Diario</button>
              <button class="btn btn--ghost" id="btnPDF" style="font-size:0.88rem;">Exportar PDF</button>
              <button class="btn btn--ghost" id="btnClose2" style="font-size:0.88rem;">Nueva Consulta</button>
            </div>
            ${p.ethics_note_es ? `<p class="muted serif" style="font-size:0.7rem; opacity:0.4; text-align:center; max-width:480px; line-height:1.5;">${escapeHtml(p.ethics_note_es)}</p>` : ''}
          </div>
        </div>

      </div>
    </div>
  `;
}

function HistoryView() {
  const items = state.history.map((s) => {
    const p = s.hexagrams?.primary;
    const dateStr = s.created_at_iso ? s.created_at_iso.split("T")[0] : "—";
    const hexTitle = p ? `${p.hanzi || ''} ${p.slug ? p.slug.charAt(0).toUpperCase() + p.slug.slice(1) : 'Consulta'}` : 'Consulta';
    return `
      <div class="card history-card" data-open="${escapeHtml(s.id)}" style="cursor:pointer; display:flex; align-items:center; gap:16px; padding:18px 24px;">
        <div class="seal" style="width:36px; height:36px; font-size:13px; flex-shrink:0;">${p?.id || '?'}</div>
        <div class="vstack" style="gap:2px; flex:1; min-width:0;">
          <div style="font-weight:600; font-size:1rem;">${escapeHtml(hexTitle)}</div>
          <div class="muted serif" style="font-size:0.78rem;">${dateStr} · ${escapeHtml(s.question?.mode || 'reflexion')}</div>
        </div>
        <div class="muted" style="max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-style:italic; font-size:0.85rem; flex-shrink:0;">
          ${escapeHtml(s.question?.text_es || "—")}
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="vstack" style="gap:24px;">
      <div style="text-align:center;">
        <div class="seal" style="width:44px; height:44px; margin:0 auto; background:var(--indigo); font-size:20px;">◉</div>
        <h2 class="hexTitle" style="margin-top:16px;">Tu Bitácora de Cambios</h2>
        <p class="muted serif">Reflexiones anteriores para contemplar el camino.</p>
      </div>

      <div class="vstack" style="gap:12px;">
        ${state.history.length
      ? items
      : `<div class="card muted serif" style="text-align:center; padding:40px;">Aún no has guardado ninguna reflexión.</div>`
    }
      </div>

      <div class="hstack" style="justify-content:center; gap:16px; flex-wrap:wrap;">
        <button class="btn btn--primary" id="btnBackHome2">Regresar</button>
        ${state.history.length ? `<button class="btn btn--ghost" id="btnClearHistory">Limpiar todo</button>` : ""}
      </div>
    </div>
  `;
}

function BootErrorView() {
  return `
    <div class="vstack" style="align-items:center; text-align:center; gap:24px; padding:40px 0;">
      <div class="seal" style="background:var(--vermilion); width:56px; height:56px; font-size:24px;">!</div>
      <h2 class="hexTitle">Error de Arranque</h2>
      <p class="serif muted" style="max-width:400px;">
        No se pudieron cargar los archivos necesarios para el oráculo.
        Por favor, verifica tu conexión a internet.
      </p>
      <div class="card" style="background:var(--accent-soft); font-family:monospace; font-size:0.78rem; text-align:left; max-width:500px; width:100%;">
        <strong>Error:</strong> ${escapeHtml(state.boot.error || "Desconocido")}
        ${state.boot.missing.length ? `<br><br><strong>Faltan:</strong> ${state.boot.missing.join(", ")}` : ""}
      </div>
      <button class="btn btn--primary" onclick="location.reload()">Reintentar</button>
    </div>
  `;
}

function opt(val, label) {
  return `<option value="${val}" ${state.draft.question.mode === val ? "selected" : ""}>${label}</option>`;
}

function renderStageCoins() {
  // SVG for Yang face (Heads) — solid Yang line, golden bronze coin
  const yangFaceSVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
      <defs>
        <!-- Warm bronze body gradient -->
        <radialGradient id="coinGrad-yang" cx="38%" cy="35%" r="65%">
          <stop offset="0%"   stop-color="hsl(42, 80%, 75%)"/>
          <stop offset="40%"  stop-color="hsl(38, 70%, 58%)"/>
          <stop offset="75%"  stop-color="hsl(34, 65%, 40%)"/>
          <stop offset="100%" stop-color="hsl(30, 55%, 28%)"/>
        </radialGradient>
        <!-- Specular highlight -->
        <radialGradient id="specular-yang" cx="30%" cy="28%" r="40%">
          <stop offset="0%"   stop-color="hsl(48, 90%, 85%)" stop-opacity="0.6"/>
          <stop offset="100%" stop-color="hsl(42, 70%, 60%)" stop-opacity="0"/>
        </radialGradient>
        <!-- Rim inner shadow -->
        <radialGradient id="rimShadow-yang" cx="50%" cy="50%" r="50%">
          <stop offset="82%"  stop-color="transparent"/>
          <stop offset="100%" stop-color="hsl(30, 50%, 18%)" stop-opacity="0.55"/>
        </radialGradient>
        <!-- Square hole gradient -->
        <linearGradient id="holeGrad-yang" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stop-color="hsl(240, 10%, 8%)"/>
          <stop offset="100%" stop-color="hsl(240, 8%, 14%)"/>
        </linearGradient>
        <!-- Noise texture filter -->
        <filter id="texture-yang" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" result="noise" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise"/>
          <feBlend in="SourceGraphic" in2="grayNoise" mode="overlay" result="blended"/>
          <feComposite in="blended" in2="SourceGraphic" operator="in"/>
        </filter>
        <!-- Engraving emboss filter -->
        <filter id="emboss-yang">
          <feGaussianBlur stdDeviation="0.6" result="blur"/>
          <feSpecularLighting in="blur" surfaceScale="3" specularConstant="0.8" specularExponent="15" result="spec" lighting-color="hsl(48,80%,82%)">
            <fePointLight x="60" y="55" z="90"/>
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="specMasked"/>
          <feBlend in="SourceGraphic" in2="specMasked" mode="screen"/>
        </filter>
      </defs>

      <!-- Main coin body -->
      <circle cx="100" cy="100" r="96" fill="url(#coinGrad-yang)" filter="url(#texture-yang)"/>

      <!-- Raised outer rim -->
      <circle cx="100" cy="100" r="96" fill="none" stroke="hsl(38, 60%, 48%)" stroke-width="6" opacity="0.6"/>
      <circle cx="100" cy="100" r="91" fill="none" stroke="hsl(42, 75%, 70%)" stroke-width="2" opacity="0.5"/>
      <circle cx="100" cy="100" r="88" fill="none" stroke="hsl(30, 50%, 28%)" stroke-width="1.5" opacity="0.4"/>

      <!-- Inner decorative ring -->
      <circle cx="100" cy="100" r="68" fill="none" stroke="hsl(38, 55%, 42%)" stroke-width="1.5" opacity="0.5" stroke-dasharray="5 3"/>

      <!-- Square center hole -->
      <rect x="79" y="79" width="42" height="42" rx="3" ry="3" fill="url(#holeGrad-yang)"/>
      <!-- Square hole inner bevel highlight -->
      <rect x="79" y="79" width="42" height="42" rx="3" ry="3" fill="none" stroke="hsl(38,65%,55%)" stroke-width="1.5" opacity="0.4"/>
      <rect x="81" y="81" width="38" height="38" rx="2" ry="2" fill="none" stroke="hsl(240,10%,5%)" stroke-width="1" opacity="0.6"/>

      <!-- Yang symbol: solid horizontal bar (☰ representation — solid yang line) -->
      <g filter="url(#emboss-yang)" opacity="0.95">
        <!-- Upper trigram bar (yang — solid) -->
        <rect x="42" y="55" width="116" height="11" rx="3" fill="hsl(240, 8%, 15%)"/>
        <!-- Middle bar -->
        <rect x="42" y="71" width="116" height="11" rx="3" fill="hsl(240, 8%, 15%)"/>
        <!-- Lower bar -->
        <rect x="42" y="87" width="33" height="11" rx="3" fill="hsl(240, 8%, 15%)"/>
        <rect x="125" y="87" width="33" height="11" rx="3" fill="hsl(240, 8%, 15%)"/>

        <!-- Bottom trigram bars -->
        <rect x="42" y="113" width="116" height="11" rx="3" fill="hsl(240, 8%, 15%)"/>
        <rect x="42" y="129" width="116" height="11" rx="3" fill="hsl(240, 8%, 15%)"/>
        <rect x="42" y="145" width="116" height="11" rx="3" fill="hsl(240, 8%, 15%)"/>
      </g>

      <!-- Specular sheen layered on top -->
      <circle cx="100" cy="100" r="96" fill="url(#specular-yang)" style="mix-blend-mode:screen;"/>

      <!-- Rim shadow vignette -->
      <circle cx="100" cy="100" r="96" fill="url(#rimShadow-yang)"/>
    </svg>`;

  // SVG for Yin face (Tails) — broken Yin line, darker aged patina
  const yinFaceSVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
      <defs>
        <!-- Darker, more aged bronze for yin -->
        <radialGradient id="coinGrad-yin" cx="38%" cy="35%" r="65%">
          <stop offset="0%"   stop-color="hsl(36, 60%, 62%)"/>
          <stop offset="40%"  stop-color="hsl(32, 52%, 45%)"/>
          <stop offset="75%"  stop-color="hsl(28, 48%, 30%)"/>
          <stop offset="100%" stop-color="hsl(22, 42%, 18%)"/>
        </radialGradient>
        <radialGradient id="specular-yin" cx="30%" cy="28%" r="40%">
          <stop offset="0%"   stop-color="hsl(44, 80%, 78%)" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="hsl(36, 60%, 50%)" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="rimShadow-yin" cx="50%" cy="50%" r="50%">
          <stop offset="82%"  stop-color="transparent"/>
          <stop offset="100%" stop-color="hsl(22, 40%, 10%)" stop-opacity="0.65"/>
        </radialGradient>
        <linearGradient id="holeGrad-yin" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stop-color="hsl(240, 10%, 6%)"/>
          <stop offset="100%" stop-color="hsl(240, 8%, 12%)"/>
        </linearGradient>
        <filter id="texture-yin" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" result="noise" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise"/>
          <feBlend in="SourceGraphic" in2="grayNoise" mode="overlay" result="blended"/>
          <feComposite in="blended" in2="SourceGraphic" operator="in"/>
        </filter>
        <filter id="emboss-yin">
          <feGaussianBlur stdDeviation="0.6" result="blur"/>
          <feSpecularLighting in="blur" surfaceScale="3" specularConstant="0.7" specularExponent="12" result="spec" lighting-color="hsl(44,70%,75%)">
            <fePointLight x="60" y="55" z="90"/>
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="specMasked"/>
          <feBlend in="SourceGraphic" in2="specMasked" mode="screen"/>
        </filter>
        <!-- Green patina splatters on yin side -->
        <filter id="patina-yin">
          <feTurbulence type="fractalNoise" baseFrequency="0.2" numOctaves="2" result="noise2"/>
          <feColorMatrix type="matrix" values="0 0 0 0 0.2  0 0 0 0 0.55  0 0 0 0 0.3  0 0 0 0.25 0" in="noise2" result="greenNoise"/>
          <feComposite in="greenNoise" in2="SourceAlpha" operator="in"/>
        </filter>
      </defs>

      <!-- Main coin body -->
      <circle cx="100" cy="100" r="96" fill="url(#coinGrad-yin)" filter="url(#texture-yin)"/>

      <!-- Green patina layer (aged look) -->
      <circle cx="100" cy="100" r="96" fill="hsl(155, 40%, 35%)" style="mix-blend-mode:overlay" opacity="0.12" filter="url(#patina-yin)"/>

      <!-- Raised outer rim -->
      <circle cx="100" cy="100" r="96" fill="none" stroke="hsl(32, 55%, 38%)" stroke-width="6" opacity="0.6"/>
      <circle cx="100" cy="100" r="91" fill="none" stroke="hsl(36, 65%, 58%)" stroke-width="2" opacity="0.4"/>
      <circle cx="100" cy="100" r="88" fill="none" stroke="hsl(22, 45%, 20%)" stroke-width="1.5" opacity="0.4"/>

      <!-- Inner ring -->
      <circle cx="100" cy="100" r="68" fill="none" stroke="hsl(32, 48%, 35%)" stroke-width="1.5" opacity="0.5" stroke-dasharray="5 3"/>

      <!-- Square center hole -->
      <rect x="79" y="79" width="42" height="42" rx="3" ry="3" fill="url(#holeGrad-yin)"/>
      <rect x="79" y="79" width="42" height="42" rx="3" ry="3" fill="none" stroke="hsl(34,55%,45%)" stroke-width="1.5" opacity="0.35"/>
      <rect x="81" y="81" width="38" height="38" rx="2" ry="2" fill="none" stroke="hsl(240,10%,4%)" stroke-width="1" opacity="0.6"/>

      <!-- Yin symbol: broken lines on both upper and lower trigrams -->
      <g filter="url(#emboss-yin)" opacity="0.9">
        <!-- Upper trigram (broken Yin lines) -->
        <rect x="42" y="55" width="47" height="11" rx="3" fill="hsl(240, 8%, 15%)"/>
        <rect x="111" y="55" width="47" height="11" rx="3" fill="hsl(240, 8%, 15%)"/>
        <rect x="42" y="71" width="47" height="11" rx="3" fill="hsl(240, 8%, 15%)"/>
        <rect x="111" y="71" width="47" height="11" rx="3" fill="hsl(240, 8%, 15%)"/>
        <rect x="42" y="87" width="47" height="11" rx="3" fill="hsl(240, 8%, 15%)"/>
        <rect x="111" y="87" width="47" height="11" rx="3" fill="hsl(240, 8%, 15%)"/>
        <!-- Lower trigram (broken Yin lines) -->
        <rect x="42" y="113" width="47" height="11" rx="3" fill="hsl(240, 8%, 15%)"/>
        <rect x="111" y="113" width="47" height="11" rx="3" fill="hsl(240, 8%, 15%)"/>
        <rect x="42" y="129" width="47" height="11" rx="3" fill="hsl(240, 8%, 15%)"/>
        <rect x="111" y="129" width="47" height="11" rx="3" fill="hsl(240, 8%, 15%)"/>
        <rect x="42" y="145" width="47" height="11" rx="3" fill="hsl(240, 8%, 15%)"/>
        <rect x="111" y="145" width="47" height="11" rx="3" fill="hsl(240, 8%, 15%)"/>
      </g>

      <!-- Specular sheen -->
      <circle cx="100" cy="100" r="96" fill="url(#specular-yin)" style="mix-blend-mode:screen;"/>

      <!-- Rim vignette -->
      <circle cx="100" cy="100" r="96" fill="url(#rimShadow-yin)"/>
    </svg>`;

  return [1, 2, 3].map(() => `
    <div class="coin-3d">
      <div class="coin-face coin-front">
        ${yangFaceSVG}
      </div>
      <div class="coin-face coin-back">
        ${yinFaceSVG}
      </div>
    </div>
  `).join('');
}


// ---------- Shell Events ----------

function bindShellEvents() {
  document.getElementById("btnOpenBook")?.addEventListener("click", () => {
    state._bookOpen = true;
    render();
  });
}

function initPageEffects() {
  const zenEl = document.getElementById("zenText");
  if (zenEl) {
    if (sageTyper) sageTyper.cancel();
    sageTyper = new Typewriter(zenEl, { typingSpeed: 35 });
    const n = state.draft.tosses.length;
    let msg = "";
    if (n === 0) msg = "Concentra tu mente en la pregunta... Lanza las monedas cuando sientas calma interior.";
    else if (n < 6) msg = `El oráculo escucha... Línea ${n + 1} de 6. Sostén la pregunta en tu mente.`;
    else msg = "El hexagrama está completo. La respuesta del Libro aguarda.";
    sageTyper.type(msg);
  }

  // Tilt effect on cards
  document.querySelectorAll(".card:not([data-no-tilt])").forEach(c => new TiltCard(c));
}

// ---------- Toss Logic ----------

function onTossNextLine() {
  if (state._tossing) return;
  dispatchFox('USER_TAP_PRIMARY');
  const n = state.draft.tosses.length;
  if (n >= 6) {
    finishToss();
    return;
  }

  state._tossing = true;
  render();

  const ensoEl = document.getElementById("ensoTarget");
  if (ensoEl) new EnsoLoader(ensoEl).show(2000);

  setTimeout(() => {
    const coinEls = document.querySelectorAll(".coin-3d");
    coinEls.forEach(el => el.classList.add("tossing"));

    setTimeout(() => {
      coinEls.forEach(el => el.classList.remove("tossing"));

      const line = tossLine();
      state.draft.tosses.push(line);

      // Show coin result orientation
      coinEls.forEach((el, idx) => {
        const isHeads = line.coins[idx] === 'heads';
        el.style.transform = isHeads ? `rotateY(0deg)` : `rotateY(180deg)`;
      });

      // Brief pause to show result, then re-render
      setTimeout(() => {
        state._tossing = false;
        render();
        if (state.draft.tosses.length === 6) {
          const btn = document.getElementById("btnToss");
          if (btn) btn.textContent = t("toss.btn_finish") || "Ver Lectura";
        }
      }, 600);

    }, 1250);
  }, 50);
}

function finishToss() {
  try {
    const reading = buildReading(state.draft.tosses);
    state.session = {
      id: cryptoRandomId(),
      question: { ...state.draft.question },
      created_at_iso: new Date().toISOString(),
      method: state.draft.tossMode === 'manual' ? 'three_coins_manual' : 'three_coins',
      ...reading
    };
    trackEvent("reading_viewed", { hex_id: state.session.hexagrams.primary?.id });
    nav("reading");
  } catch (e) {
    console.error("Finish toss fail", e);
    openModal("Error", `<p>No se pudo construir la lectura: ${escapeHtml(e.message)}</p>`);
  }
}

// Manual toss: toggle one coin between heads/tails
function toggleCoin(idx) {
  const c = state.draft.manualCoins;
  c[idx] = c[idx] === 'heads' ? 'tails' : 'heads';
  render();
}

// Manual toss: confirm current coin selection as a line
function onManualConfirm() {
  const n = state.draft.tosses.length;
  if (n >= 6) { finishToss(); return; }

  const coins = state.draft.manualCoins; // ['heads','tails','heads']
  const sum = coins.reduce((s, f) => s + (f === 'heads' ? 3 : 2), 0);

  // Compute outcome exactly like tossLine() does
  const outcomes = { '6': { value: 6, is_moving: true, type: 'old_yin' }, '7': { value: 7, is_moving: false, type: 'young_yang' }, '8': { value: 8, is_moving: false, type: 'young_yin' }, '9': { value: 9, is_moving: true, type: 'old_yang' } };
  const outcome = outcomes[String(sum)] || outcomes['7'];

  const line = {
    ...outcome,
    coins: [...coins],
    position: n + 1
  };

  state.draft.tosses.push(line);
  // Reset coins to all-heads for next line
  state.draft.manualCoins = ['heads', 'heads', 'heads'];

  dispatchFox('USER_TAP_PRIMARY');
  render();
  if (state.draft.tosses.length === 6) {
    // Auto-show finish button, no action needed — user will click
  }
}

// ---------- Page Events ----------

function bindPageEvents(root) {
  if (!root) return;

  // Home
  const btnBegin = root.querySelector("#btnBegin");
  if (btnBegin) {
    btnBegin.addEventListener("click", () => {
      const qTextEl = root.querySelector("#qText");
      const q = qTextEl ? qTextEl.value.trim() : "";

      if (!q) {
        openModal(t("home.error_empty_question") || "Falta pregunta",
          `<p class="serif">${t("home.error_empty_question_body") || "Por favor escribe algo para reflexionar."}</p>`);
        return;
      }
      beginToss();
    });
  }

  root.querySelector("#qText")?.addEventListener("input", e => {
    state.draft.question.text_es = e.target.value;
  });
  root.querySelector("#qMode")?.addEventListener("change", e => {
    state.draft.question.mode = e.target.value;
  });
  root.querySelector("#btnHistoryShortcut")?.addEventListener("click", openHistory);

  // Toss — digital
  root.querySelector("#btnToss")?.addEventListener("click", onTossNextLine);
  root.querySelector("#btnFinish")?.addEventListener("click", finishToss);
  root.querySelector("#btnBackHome")?.addEventListener("click", startNew);

  // Toss — mode toggle
  root.querySelector("#btnModeDigital")?.addEventListener("click", () => {
    state.draft.tossMode = 'digital';
    render();
  });
  root.querySelector("#btnModeManual")?.addEventListener("click", () => {
    state.draft.tossMode = 'manual';
    render();
  });

  // Toss — manual coin selectors
  root.querySelectorAll(".manual-coin-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-idx"), 10);
      toggleCoin(idx);
    });
  });
  root.querySelector("#btnManualConfirm")?.addEventListener("click", onManualConfirm);

  // Reading (immersive scroll view)
  root.querySelector("#btnSave")?.addEventListener("click", saveSession);
  root.querySelector("#btnSave2")?.addEventListener("click", saveSession);
  root.querySelector("#btnPDF")?.addEventListener("click", exportPDF);
  root.querySelector("#btnClose")?.addEventListener("click", startNew);
  root.querySelector("#btnClose2")?.addEventListener("click", startNew);


  // History
  root.querySelector("#btnBackHome2")?.addEventListener("click", startNew);
  root.querySelector("#btnClearHistory")?.addEventListener("click", deleteHistory);

  root.querySelectorAll("[data-open]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-open");
      const sess = state.history.find(s => s.id === id);
      if (sess) {
        state.session = sess;
        nav("reading");
      }
    });
  });
}

// ---------- Helpers ----------

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
  const arr = new Uint32Array(3);
  crypto.getRandomValues(arr);
  return "sess_" + Array.from(arr).map(n => n.toString(36)).join('');
}

function openModal(title, content) {
  const m = document.getElementById("modal");
  const tEl = document.getElementById("modalTitle");
  const bEl = document.getElementById("modalBody");
  if (m && tEl && bEl) {
    tEl.innerText = title;
    bEl.innerHTML = content;
    m.showModal();
  }
}
