import { BubbleMenu, Typewriter, InkGalaxy, TiltCard, EnsoLoader, DynamicHexagram, drawHanzi, InteractiveBook, DynamicAvatar } from "./ui-lib.js";
import {
  initEngine,
  trackEvent,
  tossLine,
  buildReading,
  t
} from "./engine.js";

// Global UI Instances
let sageTyper = null;
let bubbleMenu = null;
let galaxy = null;
let homeAvatar = null;
let tossAvatar = null;
let interactiveBookInstance = null;

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
    tosses: []
  },

  // Active Session (Displaying Reading)
  session: null,

  // UI State
  _tossing: false,
  _bookOpen: false,

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

  // Init Grain (Paper Texture)
  if (window.grained) {
    grained("body", {
      animate: true,
      patternWidth: 100,
      patternHeight: 100,
      grainOpacity: 0.04,
      grainDensity: 1.2,
      grainWidth: 1.5,
      grainHeight: 1.5,
      grainChaos: 0.5,
      grainSpeed: 20
    });
  }

  // Init Ink Galaxy Background
  galaxy = new InkGalaxy({ count: 160 });

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

  if (!document.getElementById("theBook")) {
    root.innerHTML = BookShellHTML();
    bindShellEvents();
  }

  const book = document.getElementById("theBook");
  if (state._bookOpen) {
    book.classList.add("open");
    document.body.classList.add("book-is-open");
  } else {
    book.classList.remove("open");
    document.body.classList.remove("book-is-open");
  }

  const pageContainer = document.getElementById("bookPageContent");
  if (!pageContainer) return;

  if (!state.boot.ok) {
    pageContainer.innerHTML = BootErrorView();
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

  pageContainer.innerHTML = `<div class="fade-in">${contentHTML}</div>`;

  bindPageEvents(pageContainer);
  initPageEffects();
  renderDynamicVisuals();
}

function renderDynamicVisuals() {
  // Home Avatar
  const homeTarget = document.getElementById("homeAvatarTarget");
  if (homeTarget) {
    if (homeAvatar) homeAvatar.destroy();
    homeAvatar = new DynamicAvatar("./assets/sage.png", homeTarget);
    homeAvatar.render();
  } else if (homeAvatar) {
    homeAvatar.destroy();
    homeAvatar = null;
  }

  // Toss Avatar
  const tossTarget = document.getElementById("tossAvatarTarget");
  if (tossTarget) {
    if (tossAvatar) tossAvatar.destroy();
    tossAvatar = new DynamicAvatar("./assets/sage.png", tossTarget);
    tossAvatar.render();
  } else if (tossAvatar) {
    tossAvatar.destroy();
    tossAvatar = null;
  }

  if (state.nav === "reading" && state.session) {
    initInteractiveBook(state.session);
  } else if (interactiveBookInstance) {
    interactiveBookInstance.destroy();
    interactiveBookInstance = null;
  }
}

function initInteractiveBook(sess) {
  const container = document.getElementById("bookFlipContainer");
  if (!container) return;

  if (interactiveBookInstance) interactiveBookInstance.destroy();
  interactiveBookInstance = new InteractiveBook(container);

  const book = interactiveBookInstance;
  const p = sess.hexagrams?.primary;
  const r = sess.hexagrams?.resulting;

  if (!p) {
    container.innerHTML = `<div class="card" style="text-align:center; padding:40px;"><p class="serif muted">Error al cargar la lectura. Intenta una nueva consulta.</p></div>`;
    return;
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
                  <div class="muted serif" style="font-size:0.7rem;">${escapeHtml((p.trigrams?.upper?.keywords_es || []).slice(0,2).join(' · '))}</div>
              </div>
              <div class="card" style="flex:1; padding:16px; text-align:center; gap:8px;">
                  <div class="muted serif" style="font-size:0.7rem; text-transform:uppercase; letter-spacing:0.08em;">Inferior</div>
                  <div style="font-size:1.8rem; line-height:1;">${p.trigrams?.lower?.symbol_unicode || ''}</div>
                  <div style="font-weight:600; font-size:0.9rem;">${escapeHtml(p.trigrams?.lower?.name_es || p.lower_trigram || '—')}</div>
                  <div class="muted serif" style="font-size:0.7rem;">${escapeHtml((p.trigrams?.lower?.keywords_es || []).slice(0,2).join(' · '))}</div>
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

  const resContainer = document.getElementById("resultingHexSVG");
  if (resContainer && r?.lines) {
    new DynamicHexagram(r.lines).render(resContainer);
  }

  // Re-bind page events (buttons inside book pages)
  const bookRoot = document.getElementById("bookFlipContainer");
  bindPageEvents(bookRoot);
}

function BookShellHTML() {
  return `
    <div class="app-container">
      <div class="content-wrapper">
        <div class="book-scene">
           <div class="book" id="theBook">
              <!-- Cover -->
              <div class="book-face book-front">
                 <div class="vstack" style="align-items:center; gap:32px;">
                    <div class="book-cover-seal">易</div>
                    <div style="text-align:center;">
                       <h1 class="book-cover-title">I CHING</h1>
                       <p class="serif" style="font-style:italic; opacity:0.7; margin:8px 0 0; font-size:1rem; letter-spacing:0.05em;">El Libro de las Mutaciones</p>
                    </div>
                    <div class="book-cover-divider"></div>
                    <button class="btn book-cover-btn" id="btnOpenBook">Consultar el Oráculo</button>
                    <p class="serif" style="opacity:0.4; font-size:0.72rem; margin:0; letter-spacing:0.08em; text-transform:uppercase;">Sabiduría Taoísta · Reflexión Local</p>
                 </div>
              </div>

              <!-- Inside (Pages) -->
              <div class="book-face book-inside">
                 <div id="bookPageContent" class="vstack" style="flex:1;"></div>
                 <div class="divider"></div>
                 <div style="text-align:center;" class="muted serif" style="font-size:0.75rem; opacity:0.5;">
                    I Ching · Reflexión Local · v1.1
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  `;
}

function HomeFormView() {
  return `
    <div class="vstack" style="gap:32px;">
      <div class="sage-container">
         <div id="homeAvatarTarget"></div>
         <div class="sage-bubble">
            El Tao que puede nombrarse no es el Tao eterno.<br>
            Presenta tu pregunta con sinceridad y deja que el Libro hable.
         </div>
      </div>

      <div style="text-align:center;">
         <div class="seal" style="width:48px; height:48px; margin:0 auto; background:var(--indigo); font-size:22px;">易</div>
         <h2 class="hexTitle" style="margin-top:16px;">${t("home.title") || "Nueva Consulta"}</h2>
         <p class="muted serif">${t("home.subtitle") || "Plantea una pregunta abierta para iniciar."}</p>
      </div>

      <div class="vstack" style="gap:20px;">
        <div class="vstack" style="gap:8px;">
          <label class="muted serif" style="font-size:0.85rem; text-transform:uppercase; letter-spacing:0.06em;">${t("home.label_focus") || "Foco / Ámbito"}</label>
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
          <label class="muted serif" style="font-size:0.85rem; text-transform:uppercase; letter-spacing:0.06em;">${t("home.label_question") || "Pregunta"}</label>
          <textarea id="qText" class="input-field" style="min-height:120px; resize:none;" placeholder="${t("home.placeholder_question") || "¿Qué actitud conviene sostener ante esta situación?"}">${escapeHtml(state.draft.question.text_es || "")}</textarea>
        </div>
      </div>

      <div style="display:flex; justify-content:center; margin-top:8px;">
        <button class="btn btn--primary" id="btnBegin" style="width:100%; max-width:320px; padding:20px 40px; font-size:1.05rem;">${t("home.btn_toss") || "Tirar Monedas"}</button>
      </div>

      ${state.history.length > 0 ? `
      <div style="text-align:center; margin-top:-10px;">
        <button class="btn btn--ghost" id="btnHistoryShortcut" style="font-size:0.85rem; padding:12px 24px;">Ver historial (${state.history.length})</button>
      </div>
      ` : ''}
    </div>
  `;
}

function TossView() {
  const n = state.draft.tosses.length;
  const isComplete = n >= 6;

  return `
    <div class="vstack" style="gap:24px;">
      <div class="sage-container">
         <div id="tossAvatarTarget"></div>
         <div class="sage-bubble">
            <span id="zenText"></span>
         </div>
      </div>

      <div class="card" style="text-align:center; padding:clamp(20px, 5vw, 40px);">
        <div style="margin-bottom:16px;">
           <span class="muted serif" style="font-size:0.85rem; text-transform:uppercase; letter-spacing:0.08em;">
             ${isComplete ? 'Hexagrama completo' : `Línea ${n + 1} de 6`}
           </span>
        </div>

        <div class="coin-stage" id="coinStage">
           ${renderStageCoins()}
        </div>

        <div id="ensoTarget" style="min-height:20px;"></div>

        <div class="divider"></div>

        <div class="hstack" style="justify-content:center; gap:16px; flex-wrap:wrap;">
          <button class="btn btn--primary" id="btnToss" ${state._tossing ? "disabled" : ""} style="min-width:160px;">
            ${isComplete ? (t("toss.btn_finish") || "Ver Lectura") : (t("toss.btn_toss") || "Tirar")}
          </button>
          <button class="btn btn--ghost" id="btnBackHome" ${state._tossing ? "disabled" : ""} style="font-size:0.9rem;">Abandonar</button>
        </div>
      </div>

      ${n > 0 ? `
      <div style="display:flex; justify-content:center;">
          <div class="hex-accumulator">
            <div class="muted serif" style="font-size:0.7rem; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:12px; text-align:center;">Hexagrama acumulado</div>
            ${renderHexLines(state.draft.tosses)}
          </div>
      </div>
      ` : ''}
    </div>
  `;
}

function renderHexLines(tosses) {
  if (tosses.length === 0) return "";
  const items = tosses.map(toss => {
    const val = toss.value || toss.sum || 7;
    const isYin = val % 2 === 0; // 6, 8 = yin; 7, 9 = yang
    const isMoving = toss.is_moving;
    return `<div class="hex-line ${isYin ? 'yin' : 'yang'}${isMoving ? ' moving' : ''}"></div>`;
  }).reverse();
  return `<div class="hex-visual" style="padding:16px 24px; gap:8px;">${items.join("")}</div>`;
}

function ReadingView() {
  if (!state.session) {
    return `<div style="text-align:center; padding:40px 0;"><p class="serif muted">Sin sesión activa. Inicia una nueva consulta.</p></div>`;
  }
  return `<div id="bookFlipContainer"></div>`;
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
  return [1, 2, 3].map(() => `
    <div class="coin-3d">
      <div class="coin-face coin-front">
        <img src="./assets/coin_yang.png" alt="Yang" decoding="async" loading="lazy">
      </div>
      <div class="coin-face coin-back">
        <img src="./assets/coin_yin.png" alt="Yin" decoding="async" loading="lazy">
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
      method: "three_coins",
      ...reading
    };
    trackEvent("reading_viewed", { hex_id: state.session.hexagrams.primary?.id });
    nav("reading");
  } catch (e) {
    console.error("Finish toss fail", e);
    openModal("Error", `<p>No se pudo construir la lectura: ${escapeHtml(e.message)}</p>`);
  }
}

// ---------- Page Events ----------

function bindPageEvents(root) {
  if (!root) return;

  // Home
  root.querySelector("#btnBegin")?.addEventListener("click", () => {
    const q = state.draft.question.text_es.trim();
    if (!q) {
      openModal(t("home.error_empty_question") || "Falta pregunta",
        `<p class="serif">${t("home.error_empty_question_body") || "Por favor escribe algo para reflexionar."}</p>`);
      return;
    }
    beginToss();
  });
  root.querySelector("#qText")?.addEventListener("input", e => {
    state.draft.question.text_es = e.target.value;
  });
  root.querySelector("#qMode")?.addEventListener("change", e => {
    state.draft.question.mode = e.target.value;
  });
  root.querySelector("#btnHistoryShortcut")?.addEventListener("click", openHistory);

  // Toss
  root.querySelector("#btnToss")?.addEventListener("click", onTossNextLine);
  root.querySelector("#btnBackHome")?.addEventListener("click", startNew);

  // Reading (inside interactive book)
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
      if (sess) {
        state.session = sess;
        nav("reading");
      }
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
