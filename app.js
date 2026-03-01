// app.js
// Cerebro de la aplicación. Gestiona estado, navegación y eventos.
// Las vistas HTML están en views.js. La lógica del I Ching está en engine.js.
// La autenticación y el estado del usuario están en auth.js.

import { BubbleMenu, Typewriter, InkGalaxy, TiltCard, EnsoLoader, DynamicHexagram, drawHanzi, InteractiveBook, DynamicAvatar } from "./ui-lib.js";
import { initEngine, trackEvent, tossLine, buildReading, t } from "./engine.js";
import { currentUser, initAuth, startCheckout } from "./auth.js";
import {
  escapeHtml,
  BookShellHTML, HomeFormView, TossView, ReadingView, HistoryView, BootErrorView
} from "./views.js";

// ─── Instancias de UI ─────────────────────────────────────────────────────────
let sageTyper = null;
let bubbleMenu = null;
let galaxy = null;
let homeAvatar = null;
let tossAvatar = null;
let interactiveBookInstance = null;

// ─── Estado Global ────────────────────────────────────────────────────────────

var state = {
  // Boot status
  boot: { ok: true, missing: [], error: null },

  // Navegación: 'home' | 'toss' | 'reading' | 'history'
  nav: "home",

  // Historial local (localStorage)
  history: [],

  // Borrador de la consulta actual
  draft: {
    question: { text_es: "", mode: "reflexion" },
    tosses: []
  },

  // Sesión activa (lectura en pantalla)
  session: null,

  // Estado de la UI
  _tossing: false,
  _bookOpen: false,

  // Entitlements locales — todos activos en la versión local.
  // Cuando Firebase Auth esté integrado, estos se derivarán de currentUser.isPremium.
  entitlements: {
    unlimited_history: true,
    premium_sections: true,
    pdf_export: true,
    full_access: true,
    journal_mode: true,
    export_tools: true
  }
};

// ─── Constantes ───────────────────────────────────────────────────────────────
const LS_KEY = "iching_sessions_v1";
const LS_THEME = "iching_theme_v1";

// ─── Init ─────────────────────────────────────────────────────────────────────
(async function init() {
  loadLocal();
  if (!state.history) state.history = [];

  initBubbleMenu();

  // Smooth Scroll (Lenis)
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
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
  }

  // Grain (Paper Texture)
  if (window.grained) {
    grained("body", {
      animate: true, patternWidth: 100, patternHeight: 100,
      grainOpacity: 0.04, grainDensity: 1.2,
      grainWidth: 1.5, grainHeight: 1.5,
      grainChaos: 0.5, grainSpeed: 20
    });
  }

  // Ink Galaxy Background
  galaxy = new InkGalaxy({ count: 160 });

  // Inicializar motor del I Ching
  try {
    await initEngine();
    state.boot.ok = true;
    trackEvent("session_start");
  } catch (e) {
    state.boot.ok = false;
    state.boot.error = String(e?.message || e);
    if (e.missing && Array.isArray(e.missing)) state.boot.missing = e.missing;
  }

  // Inicializar Auth (placeholder — cuando Firebase esté listo, poblará currentUser)
  await initAuth();

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

// ─── Storage ──────────────────────────────────────────────────────────────────

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

// ─── Theme ────────────────────────────────────────────────────────────────────

function onToggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "ink" ? "paper" : "ink");
}

function applyTheme(name) {
  document.documentElement.setAttribute("data-theme", name);
  localStorage.setItem(LS_THEME, name);
}

// ─── Service Worker ───────────────────────────────────────────────────────────

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try { await navigator.serviceWorker.register('./sw.js'); } catch { /* silent */ }
}

// ─── Navegación ───────────────────────────────────────────────────────────────

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

// ─── Acciones ─────────────────────────────────────────────────────────────────

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

function openHistory() { nav("history"); }

function deleteHistory() {
  state.history = [];
  saveLocal();
  openModal("Historial borrado", `<p style="font-family:var(--font-serif);">No queda nada guardado en este dispositivo.</p>`);
  render();
}

function exportPDF() { window.print(); }

// ─── Render ───────────────────────────────────────────────────────────────────

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
    pageContainer.innerHTML = BootErrorView(state);
    return;
  }

  let contentHTML = "";
  switch (state.nav) {
    case "home":    contentHTML = HomeFormView(state); break;
    case "toss":    contentHTML = TossView(state); break;
    case "reading": contentHTML = ReadingView(state); break;
    case "history": contentHTML = HistoryView(state, currentUser); break;
    default:        contentHTML = HomeFormView(state);
  }

  pageContainer.innerHTML = `<div class="fade-in">${contentHTML}</div>`;

  bindPageEvents(pageContainer);
  initPageEffects();
  renderDynamicVisuals();
}

function renderDynamicVisuals() {
  const homeTarget = document.getElementById("homeAvatarTarget");
  if (homeTarget) {
    if (homeAvatar) homeAvatar.destroy();
    homeAvatar = new DynamicAvatar("./assets/sage.png", homeTarget);
    homeAvatar.render();
  } else if (homeAvatar) {
    homeAvatar.destroy();
    homeAvatar = null;
  }

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

// ─── Libro Interactivo ────────────────────────────────────────────────────────
// Construye las páginas del libro con la lectura actual.
// Se mantiene aquí porque gestiona instancias de UI (InteractiveBook, DynamicHexagram).

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
  const hexTitle = (hex) => `${hex.hanzi} · ${hex.slug.charAt(0).toUpperCase() + hex.slug.slice(1)}`;

  // Página 1: Revelación
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

  // Página 2: Imagen y Estructura
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

  // Página 3: Líneas en Movimiento (si las hay)
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

  // Página 4: Transformación o Preguntas de Poder
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

  // Página 5: Sabiduría Profunda y Acciones
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

  // Renderizar componentes visuales tras la creación del DOM del libro
  const hexContainer = document.getElementById("primaryHexSVG");
  if (hexContainer && p.lines) new DynamicHexagram(p.lines).render(hexContainer);

  const hanziContainer = document.getElementById("hanziAnimation");
  if (hanziContainer && p.hanzi) drawHanzi(hanziContainer, p.hanzi, 110);

  const resContainer = document.getElementById("resultingHexSVG");
  if (resContainer && r?.lines) new DynamicHexagram(r.lines).render(resContainer);

  // Re-bind page events (botones dentro de las páginas del libro)
  const bookRoot = document.getElementById("bookFlipContainer");
  bindPageEvents(bookRoot);
}

// ─── Shell Events ─────────────────────────────────────────────────────────────

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

  document.querySelectorAll(".card:not([data-no-tilt])").forEach(c => new TiltCard(c));
}

// ─── Lógica de Tirada ─────────────────────────────────────────────────────────

function onTossNextLine() {
  if (state._tossing) return;
  const n = state.draft.tosses.length;
  if (n >= 6) { finishToss(); return; }

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

      coinEls.forEach((el, idx) => {
        const isHeads = line.coins[idx] === 'heads';
        el.style.transform = isHeads ? `rotateY(0deg)` : `rotateY(180deg)`;
      });

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

// ─── Page Events ──────────────────────────────────────────────────────────────

function bindPageEvents(root) {
  if (!root) return;

  // Home — `id="btn-consultar"` es el punto de entrada principal a la consulta
  root.querySelector("#btn-consultar")?.addEventListener("click", () => {
    const q = state.draft.question.text_es.trim();
    if (!q) {
      openModal(
        t("home.error_empty_question") || "Falta pregunta",
        `<p class="serif">${t("home.error_empty_question_body") || "Por favor escribe algo para reflexionar."}</p>`
      );
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

  // Premium — `id="btn-checkout"` será el punto de entrada a Stripe Checkout
  root.querySelector("#btn-checkout")?.addEventListener("click", async () => {
    try {
      // TODO: obtener priceId desde data/products.json o variable de entorno
      await startCheckout("price_placeholder");
    } catch {
      openModal(
        "Premium — Próximamente",
        `<p class="serif" style="line-height:1.7;">La suscripción Premium estará disponible pronto.<br>
        Cuando Firebase y Stripe estén configurados, este botón abrirá el checkout.</p>`
      );
    }
  });

  // History card: abrir sesión guardada
  root.querySelectorAll("[data-open]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-open");
      const sess = state.history.find(s => s.id === id);
      if (sess) { state.session = sess; nav("reading"); }
    });
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
