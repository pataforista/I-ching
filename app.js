import { BubbleMenu, Typewriter, InkGalaxy, Stepper, TiltCard } from "./ui-lib.js";
import {
  initEngine,
  trackEvent,
  tossLine,
  buildReading,
  getProducts,
  purchaseLocal,
  revokeLocal,
  isContentLoaded,
  getLicenses
} from "./engine.js";

// Global UI Instances
let sageTyper = null;
let bubbleMenu = null;
let galaxy = null;

var state = {
  // Boot status
  boot: { ok: true, missing: [], error: null },

  // Navigation: 'home' | 'toss' | 'reading' | 'history' | 'paywall'
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
  _paywallFeature: null, // "history_limit" | "pdf_export"

  // Mock Entitlements (Local Logic)
  entitlements: {
    unlimited_history: false,
    premium_sections: false,
    pdf_export: false
  },
  _bookOpen: false
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
  bubbleMenu = new BubbleMenu([
    { label: "Inicio", onClick: () => startNew() },
    { label: "Historial", onClick: () => openHistory() },
    { label: "Tema", onClick: () => onToggleTheme() },
    {
      label: "Acerca de", onClick: () => {
        openModal("Acerca de", "<p>I Ching - Reflexión Local</p><div class='muted'>Versión Premium Ukiyo-e</div>");
      }
    }
  ]);
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
  else document.documentElement.setAttribute("data-theme", "ink");
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

function saveSession() {
  if (!state.session) return;

  // Limite de historial (Freemium logic)
  if (!state.entitlements.unlimited_history && state.history.length > 0) {
    const modalContent = `
      <p>${t("history.limit_modal_body")}</p>
      <div class="callout" style="border-left-color:var(--accent);">
        <div style="font-weight:bold;">${t("history.limit_modal_question")}</div>
        <div class="muted" style="font-size:0.9em;">${t("history.limit_modal_warning", { date: state.history[0].created_at_iso.split("T")[0] })}</div>
      </div>
      <div class="vstack" style="gap:10px; margin-top:20px;">
        <button class="btn btn--primary" id="btnUpgradeSave">${t("history.btn_upgrade_save")}</button>
        <button class="btn btn--danger" id="btnOverwriteSave">${t("history.btn_overwrite_save")}</button>
      </div>
    `;
    openModal(t("history.limit_modal_title"), modalContent);
    trackEvent("feature_locked", { feature_id: "history_limit" });

    // Bind modal buttons immediately
    setTimeout(() => {
      document.getElementById("btnUpgradeSave")?.addEventListener("click", () => {
        trackEvent("overwrite_decision", { choice: "upgrade" });
        document.getElementById("modal").close();
        openPaywall("history_limit_save");
      });
      document.getElementById("btnOverwriteSave")?.addEventListener("click", () => {
        trackEvent("overwrite_decision", { choice: "overwrite" });
        document.getElementById("modal").close();
        performSave(true); // overwrite = true
      });
    }, 50);
    return;
  }

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
  if (!state.entitlements.pdf_export) {
    trackEvent("feature_locked", { feature_id: "pdf_export" });
    openPaywall("pdf_export");
    return;
  }
  window.print();
}

function openPaywall(feature) {
  trackEvent("paywall_viewed", { source: feature });
  nav("paywall");
  state._paywallFeature = feature;
}

function unlockPremiumLocal() {
  const prods = getProducts();
  if (prods?.products?.length > 0) {
    const pid = prods.products[0].product_id;
    state.entitlements = purchaseLocal(pid);
    trackEvent("purchase_completed", { product_id: pid });
    render();
    openModal(t("paywall.modal_unlocked"), `<p>${t("paywall.modal_unlocked_body")}</p>`);
  }
}

function lockPremiumLocal() {
  const prods = getProducts();
  if (prods?.products?.length > 0) {
    const pid = prods.products[0].product_id;
    state.entitlements = revokeLocal(pid);
    render();
    openModal(t("paywall.modal_locked"), `<p>${t("paywall.modal_locked_body")}</p>`);
  }
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
  if (state._bookOpen) book.classList.add("open");
  else book.classList.remove("open");

  // 3. Render Page Content inside the Book
  const pageContainer = document.getElementById("bookPageContent");
  if (!pageContainer) return; // Should exist if shell exists

  // If boot error, override
  if (!state.boot.ok) {
    pageContainer.innerHTML = BootErrorView(); // Returns string now for simplicity? No, let's keep consistent.
    // Actually our previous views returned strings (HTML).
    return;
  }

  let contentHTML = "";
  switch (state.nav) {
    case "home": contentHTML = HomeFormView(); break;
    case "toss": contentHTML = TossView(); break;
    case "reading": contentHTML = ReadingView(); break;
    case "history": contentHTML = HistoryView(); break;
    case "paywall": contentHTML = PaywallView(); break;
    default: contentHTML = HomeFormView();
  }

  // Simple diff to avoid destructive re-renders if not needed?
  // For now, simpler to just replace innerHTML. 
  // IMPORTANT: Re-binding events is needed after innerHTML replacement.
  pageContainer.innerHTML = contentHTML;

  // 4. Post-Render logic (Events, Typewriters)
  bindPageEvents(pageContainer);
  initPageEffects(); // e.g. Typewriter
}

function BookShellHTML() {
  return `
    <section class="max-w" style="display:grid; place-items:center; min-height:85vh;">
       <div class="book-scene">
          <div class="book" id="theBook">
             <!-- Cover -->
             <div class="book-face book-front">
                <div class="book-cover-title-box">
                   <div class="seal" style="width:60px; height:60px; font-size:32px; margin:0 auto 10px; background:var(--vermilion);">IC</div>
                   <h1 class="hexTitle gold-foil" style="font-size:36px; margin:0; opacity:0.9;">I CHING</h1>
                   <div class="muted" style="margin-top:10px; font-family:var(--font-serif); font-style:italic;">Libro de las Mutaciones</div>
                </div>
                <button class="book-btn" id="btnOpenBook">Consultar</button>
             </div>

             <!-- Inside (Pages) -->
             <div class="book-face book-inside">
                <!-- Dynamic Content Here -->
                <div id="bookPageContent" class="vstack" style="flex:1;"></div>
                
                <!-- Footer inside book -->
                <div style="margin-top:20px; text-align:center; opacity:0.4; font-size:10px; font-family:var(--font-serif);">
                   Reflexión Local · v1.0
                </div>
             </div>
          </div>
       </div>
    </section>
  `;
}

function bindShellEvents() {
  document.getElementById("btnOpenBook")?.addEventListener("click", () => {
    state._bookOpen = true;
    render();
  });
}

function initPageEffects() {
  // Toss View Effects
  if (state.nav === "toss") {
    // Sage Typer
    const msgEl = document.getElementById("zenText");
    if (msgEl) {
      // Always recreate to bind to new DOM element
      sageTyper = new Typewriter(msgEl, { typingSpeed: 30, cursor: true });

      // Initial text only if start of session
      if (!state._tossing && state.draft.tosses.length === 0) {
        sageTyper.type("La respuesta que buscas ya reside en tu interior. Lanza las monedas...");
      }
    }

    // Stepper
    const stepEl = document.getElementById("tossStepper");
    if (stepEl) {
      // Calculate current step (1-indexed input for user, 0-indexed info in array)
      // tosses.length is 0 -> Step 1
      // tosses.length is 1 -> Step 2
      const currentLine = state.draft.tosses.length + 1;

      new Stepper(stepEl, {
        initialStep: currentLine,
        totalSteps: 6,
        disableStepIndicators: true, // Non-interactive
        stepContainerClassName: 'stepper-mini', // Custom override if needed
        renderStepIndicator: (step, isActive, isCompleted) => {
          // Custom Ink Dot rendering if needed, or default
          // Let's use default styles but maybe smaller?
          // For now default is fine.
          let classes = "step-dot";
          if (isActive) classes += " active";
          if (isCompleted) classes += " completed";
          // Using chinese numbers or just Roman/Arabic? Arabic is clearer.
          // Or maybe Yi Jing lines style? Let's stick to numbers for clarity.
          return `<div class="${classes}" style="width:24px; height:24px; font-size:12px;">${step}</div>`;
        }
      });
    }

  } else if (state.nav === "history") {
    document.querySelectorAll(".history-card").forEach(el => {
      new TiltCard(el, { maxTilt: 10, scale: 1.02 });
    });
    sageTyper = null;

  } else {
    sageTyper = null;
  }
}



// Renamed HomeView to HomeFormView for clarity as it's just the form now
function HomeFormView() {
  return `
    <div style="text-align:center; opacity:0.7;">
       <div class="seal" style="width:40px; height:40px; margin:0 auto;">IC</div>
    </div>
    
    <div class="label" style="text-align:center; margin-top:20px;">${t("home.label_focus")}</div>
    <select id="qMode" class="input-field" style="text-align:center;">
        ${opt("reflexion", t("home.focus_options.reflexion"))}
        ${opt("decision", t("home.focus_options.decision"))}
        ${opt("relacion", t("home.focus_options.relacion"))}
        ${opt("trabajo", t("home.focus_options.trabajo"))}
        ${opt("salud", t("home.focus_options.salud"))}
        ${opt("otro", t("home.focus_options.otro"))}
    </select>

    <div class="label" style="text-align:center; margin-top:20px;">${t("home.label_question")}</div>
    <textarea id="qText" class="input-field" style="min-height:100px; text-align:center; font-style:italic;" placeholder="${t("home.placeholder_question")}">${escapeHtml(state.draft.question.text_es || "")}</textarea>

    <div class="divider"></div>

    <div class="row" style="justify-content:center; margin-top:20px;">
      <button class="btn btn--primary" id="btnBegin">${t("home.btn_toss")}</button>
    </div>
  `;
}

function TossView() {
  const n = state.draft.tosses.length;
  // Note: inside book, no section wrapper needed, just vstack
  return `
      <div class="vstack">
        
        <div class="sage-container">
           <div class="sage-aura"></div>
           <div class="sage-avatar"></div>
           <div class="sage-bubble">
              <span id="zenText"></span>
           </div>
        </div>

        <div class="card">
          <div class="hstack" style="justify-content:space-between;">
             <div class="hexTitle">${t("toss.title")}</div>
             <!-- Stepper Container -->
             <div id="tossStepper" style="flex:1; display:flex; justify-content:flex-end;"></div>
          </div>
  
          <div class="coin-stage" id="coinStage">
             ${renderStageCoins()}
          </div>
  
          <div class="divider"></div>

          <div class="row" style="justify-content:center;">
            <button class="btn btn--primary" id="btnToss" ${state._tossing ? "disabled" : ""}>
              ${n < 6 ? t("toss.btn_toss") : t("toss.btn_finish")}
            </button>
            <button class="btn btn--ghost" id="btnBackHome" ${state._tossing ? "disabled" : ""}>${t("toss.btn_cancel")}</button>
          </div>
        </div>

        <div class="vstack" style="margin-top:20px;">
          ${renderTosses(n)}
        </div>
      </div>
  `;
}

function renderStageCoins() {
  const base = `
    <div class="coin-3d"><div class="coin-face coin-front"></div><div class="coin-face coin-back"></div></div>
  `;
  return base + base + base;
}

function renderTosses(n) {
  if (n === 0) return "";
  return state.draft.tosses.map((toss, idx) => {
    const lineNo = idx + 1;
    const isYang = toss.line_bit === 1;

    // Brush style rendering for history lines
    return `
      <div class="brush-border" style="padding:10px; opacity:0.8; background:var(--panel); border-radius:var(--radius); margin-bottom:8px;">
         <div class="hstack">
            <span class="muted" style="width:20px;">${lineNo}</span>
            <div style="flex:1; height:12px; display:flex; gap:16px;">
               ${isYang
        ? `<div style="flex:1; background:var(--text); border-radius:2px; opacity:0.85;"></div>`
        : `<div style="flex:1; background:var(--text); border-radius:2px; opacity:0.85;"></div><div style="flex:1; background:var(--text); border-radius:2px; opacity:0.85;"></div>`
      }
            </div>
            ${toss.is_moving ? `<span class="badge" style="border-color:var(--accent); color:var(--accent);">Mutation</span>` : ""}
         </div>
      </div>
    `;
  }).reverse().join("");
}

async function onTossNextLine() {
  if (!state.boot.ok) return;
  if (state.draft.tosses.length >= 6) {
    finishToss();
    return;
  }

  if (state._tossing) return;
  state._tossing = true;
  render();

  const zenTexts = [
    "El universo te escucha...",
    "Concéntrate en tu pregunta...",
    "El cambio es la única constante...",
    "Siente el peso de las monedas...",
    "Deja fluir tu intención..."
  ];
  const msg = zenTexts[Math.floor(Math.random() * zenTexts.length)];
  if (sageTyper) sageTyper.type(msg);

  const stage = document.getElementById("coinStage");
  if (stage) {
    const coins = stage.querySelectorAll(".coin-3d");
    coins.forEach(c => {
      c.classList.remove("outcome-heads", "outcome-tails");
      // Reset animation
      c.style.animation = 'none';
      c.offsetHeight; /* trigger reflow */

      // Randomize speed and delay for natural feel
      const duration = 0.6 + Math.random() * 0.4; // 0.6s - 1.0s
      const delay = Math.random() * 0.1; // 0 - 0.1s offset
      c.style.animation = `spin ${duration}s infinite linear ${delay}s`;
    });

    await delay(1200);

    let tossResult;
    try {
      tossResult = tossLine();
    } catch (e) {
      state._tossing = false;
      openModal("Error", String(e));
      render();
      return;
    }

    coins.forEach((c, i) => {
      c.style.animation = 'none'; // Stop spin
      void c.offsetWidth;
      const face = tossResult.coins[i];
      const rotation = face === "heads" ? "outcome-heads" : "outcome-tails";
      c.classList.add(rotation);
    });

    await delay(800);

    state.draft.tosses.push(tossResult);
    state._tossing = false;
    render();

    const postMsg = tossResult.is_moving
      ? "¡Una línea mutante se revela!"
      : "La línea se ha fijado.";
    if (sageTyper) sageTyper.type(postMsg);
  }
}

function finishToss() {
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
}

/* --- Zen Master Utilities --- */
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }


function ReadingView() {
  if (!state.session) return `<div class="card"><div class="muted">Error de sesión.</div></div>`;

  const { primary, resulting, is_mutating } = state.session.hexagrams;
  const title = primary ? `${primary.id}. ${primary.hanzi} · ${primary.slug}` : "Unknown";

  const coreSection = `
    <div class="vstack">
      <div class="label">${t("reading.label_core")}</div>
      <div style="font-size:1.1em; font-weight:500;">${escapeHtml(primary?.dynamic_core_es || "—")}</div>
    </div>
  `;

  const imageSection = `
    <div class="vstack">
      <div class="label">${t("reading.label_image")}</div>
      <div>${escapeHtml(primary?.image_es || "—")}</div>
    </div>
  `;

  const generalSection = `
    <div class="vstack">
      <div class="label">${t("reading.label_general")}</div>
      <div style="line-height:1.6;">${escapeHtml(primary?.general_reading_es || "—")}</div>
    </div>
  `;

  const linesSection = (primary?.active_lines_content?.length > 0)
    ? `
      <div class="divider"></div>
      <div class="vstack">
        <div class="label">${t("reading.label_lines")}</div>
        ${primary.active_lines_content.map(l => `
          <div class="card" style="background:transparent; border:none; padding:10px;">
            <div class="muted" style="margin-bottom:4px;">${t("toss.line")} ${l.position}</div>
            <div>${escapeHtml(l.text)}</div>
          </div>
        `).join("")}
      </div>
    `
    : `<div class="divider"></div><div class="muted">${t("reading.no_mutations")}</div>`;

  const resultingSection = (is_mutating && resulting)
    ? `
      <div class="divider"></div>
      <div class="card" style="background:var(--panel);">
        <div class="label">${t("reading.label_resulting")}</div>
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
      <div class="vstack">
        <div class="card">
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
            <button class="btn btn--ghost" id="btnClose">${t("reading.btn_close")}</button>
            <button class="btn btn--ghost" id="btnSave">${t("reading.btn_save")}</button>
            <button class="btn btn--ghost" id="btnPDF">${t("reading.btn_pdf")}</button>
          </div>
        </div>
      </div>
  `;
}

function renderPremiumSection(hex) {
  if (!hex) return "";

  if (state.entitlements.premium_sections) {
    const qs = Array.isArray(hex.guiding_questions_es) ? hex.guiding_questions_es : [];
    return `
      <div class="callout">
        <div class="callout__title">${t("reading.premium_title")}</div>
        <div style="margin-bottom:10px;">${escapeHtml(hex.taoist_reading_es || "—")}</div>
        
        <div class="divider"></div>
        <div class="callout__title">${t("reading.premium_questions")}</div>
        <ul style="padding-left:20px; margin:0;">
          ${qs.map(q => `<li>${escapeHtml(q)}</li>`).join("")}
        </ul>
        
        <div class="divider"></div>
        <div class="callout__title">${t("reading.premium_action")}</div>
        <div>${escapeHtml(hex.micro_action_es || "—")}</div>
      </div>
    `;
  } else {
    const teaser = (hex.taoist_reading_es || "").split(" ").slice(0, 4).join(" ") + "...";
    return `
      <div class="callout" style="cursor:pointer; position:relative;" id="premiumLocked">
        <div class="callout__title">${t("reading.premium_title")}</div>
        <div style="position:relative;">
            <div style="filter:blur(4px); user-select:none; opacity:0.6;">
                ${t("reading.teaser_blur_text")}
            </div>
            <div style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; flex-direction:column; text-align:center;">
                <span style="background:var(--panel); padding:4px 8px; border-radius:4px; box-shadow:0 2px 4px rgba(0,0,0,0.1); font-weight:bold; font-size:0.9em;">
                    ${escapeHtml(teaser)}
                </span>
                <button class="btn btn--primary btn--sm" style="margin-top:8px;" id="btnUnlockTeaser">${t("reading.teaser_overlay")}</button>
            </div>
        </div>
      </div>
    `;
  }
}

function HistoryView() {
  const isUnlimited = state.entitlements.unlimited_history;

  let visibleHistory = state.history;
  let lockedCount = 0;

  if (!isUnlimited && state.history.length > 1) {
    visibleHistory = [state.history[0]];
    lockedCount = state.history.length - 1;
  }

  const rows = visibleHistory.map((s) => {
    const p = s.hexagrams?.primary;
    // Use card style
    return `
      <div class="history-card" data-open="${escapeHtml(s.id)}">
        <div class="hex-char">${escapeHtml(p?.symbol_unicode || "??")}</div>
        <div class="card-title">${escapeHtml(p?.dynamic_core_es || "Sesión")}</div>
        <div class="card-date">${escapeHtml(s.created_at_iso.split("T")[0])}</div>
        <div class="card-q">"${escapeHtml(s.question?.text_es || "—")}"</div>
      </div>
    `;
  }).join("");

  let upsell = "";
  if (!isUnlimited) {
    upsell = `
       <div class="history-card" style="justify-content:center; border:1px dashed var(--muted); background:transparent; opacity:0.7;" id="historyLocked">
          <div class="seal" style="width:40px; height:40px; font-size:20px;">+${lockedCount}</div>
          <div style="margin-top:10px; font-size:0.9em;">${t("history.locked_banner", { count: lockedCount })}</div>
       </div>
     `;
  }

  return `
      <div class="vstack">
        <div class="card" style="overflow:visible;"> <!-- Overflow visible for tilt perspective interaction -->
          <div class="hstack" style="justify-content:space-between;">
            <div class="hexTitle">${t("history.title")}</div>
            <span class="badge">${isUnlimited ? t("history.badge_full") : t("history.badge_limited")}</span>
          </div>
          <div class="divider"></div>
          
          ${state.history.length ? `<div class="history-grid">${rows}${upsell}</div>` : `<div class="muted">${t("history.empty")}</div>`}

          <div class="divider"></div>
          <div class="row">
            <button class="btn btn--ghost" id="btnBackHome2">${t("history.btn_back")}</button>
            <button class="btn btn--ghost" id="btnClearHistory">${t("history.btn_clear")}</button>
          </div>
        </div>
      </div>
  `;
}

function PaywallView() {
  const products = getProducts();
  const prod = products?.products?.[0];
  const copy = products?.paywall_copy_es;

  const title = copy?.title || "Premium";
  const body = copy?.body || "Desbloquea funciones.";
  const price = prod?.price?.formatted || "Consultar";

  const benefits = prod?.purchase_notes_es?.map(n => `<li>${escapeHtml(n)}</li>`).join("") || "";

  return `
      <div class="vstack">
        <div class="card">
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
            <button class="btn btn--primary" id="btnUnlockLocal">${t("paywall.btn_simulate")}</button>
            <button class="btn btn--ghost" id="btnLockLocal">${t("paywall.btn_revoke")}</button>
            <button class="btn btn--ghost" id="btnBackHome3">${t("paywall.btn_back")}</button>
          </div>
          
          <div class="muted" style="font-size:11px; text-align:center;">
            ${escapeHtml(copy?.footer_note || "Uso local.")}
          </div>
        </div>
      </div>
  `;
}

// ---------- Bind events ----------
function bindPageEvents(root) {
  if (!root) return;

  // Home Form
  const btnBegin = root.querySelector("#btnBegin");
  if (btnBegin) {
    const qText = root.querySelector("#qText");
    qText?.addEventListener("input", (e) => state.draft.question.text_es = e.target.value);

    const qMode = root.querySelector("#qMode");
    qMode?.addEventListener("change", (e) => state.draft.question.mode = e.target.value);

    if (qText) qText.value = state.draft.question.text_es;
    if (qMode) qMode.value = state.draft.question.mode;

    btnBegin.addEventListener("click", () => {
      if (!state.draft.question.text_es.trim()) {
        openModal(t("home.error_empty_question"), `<p>${t("home.error_empty_question_body")}</p>`);
        return;
      }
      beginToss();
    });

    root.querySelector("#btnHistory")?.addEventListener("click", openHistory);
    root.querySelector("#btnPremium")?.addEventListener("click", () => openPaywall("home"));
  }

  // Toss
  root.querySelector("#btnToss")?.addEventListener("click", onTossNextLine);
  // Back to Home now stays inside book, just nav change
  root.querySelector("#btnBackHome")?.addEventListener("click", startNew);

  // Reading
  root.querySelector("#btnClose")?.addEventListener("click", startNew);
  root.querySelector("#btnSave")?.addEventListener("click", saveSession);
  root.querySelector("#btnPDF")?.addEventListener("click", exportPDF);
  root.querySelector("#premiumLocked")?.addEventListener("click", () => openPaywall("reading_teaser"));
  root.querySelector("#btnUnlockTeaser")?.addEventListener("click", (e) => {
    e.stopPropagation();
    openPaywall("reading_overlay");
  });

  // History
  root.querySelector("#btnBackHome2")?.addEventListener("click", startNew);
  root.querySelector("#btnClearHistory")?.addEventListener("click", deleteHistory);
  root.querySelector("#historyLocked")?.addEventListener("click", () => openPaywall("history_list"));

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

  // Paywall
  root.querySelector("#btnUnlockLocal")?.addEventListener("click", unlockPremiumLocal);
  root.querySelector("#btnLockLocal")?.addEventListener("click", lockPremiumLocal);
  root.querySelector("#btnBackHome3")?.addEventListener("click", startNew);
}

// ---------- Helpers ----------
function cryptoRandomId() {
  return "sess_" + Math.random().toString(36).substr(2, 9);
}

function htmlToNode(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html.trim();
  return tpl.content; // Returns documentFragment
}

function escapeHtml(unsafe) {
  if (typeof unsafe !== "string") return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function t(key, params) {
  // Simple fallback translation mock
  const en = {
    "app.boot_error_title": "Error de carga",
    "app.boot_error_desc": "No se pudieron cargar archivos esenciales.",
    "app.unknown_error": "Error desconocido",
    "app.missing_files": "Archivos faltantes",
    "app.footer_default": "Uso personal. No sustituye criterio clínico.",
    "home.title": "I Ching",
    "home.subtitle": "Reflexión Local",
    "home.label_focus": "Enfoque",
    "home.label_question": "Tu Pregunta",
    "home.placeholder_question": "Escribe aquí tu inquietud...",
    "home.btn_toss": "Consultar",
    "home.btn_history": "Historial",
    "home.btn_unlock": "Desbloquear",
    "home.btn_your_access": "Tu Acceso",
    "home.error_empty_question": "Pregunta vacía",
    "home.error_empty_question_body": "Por favor escribe una pregunta para concentrar tu intención.",
    "home.focus_options.reflexion": "Reflexión General",
    "home.focus_options.decision": "Toma de Decisión",
    "home.focus_options.relacion": "Relaciones",
    "home.focus_options.trabajo": "Trabajo / Proyectos",
    "home.focus_options.salud": "Salud / Bienestar",
    "home.focus_options.otro": "Otro",
    "toss.title": "Consulta",
    "toss.btn_toss": "Lanzar Monedas",
    "toss.btn_finish": "Ver Lectura",
    "toss.btn_cancel": "Cancelar",
    "toss.moving": "Mutante",
    "toss.line": "Línea",
    "reading.label_core": "Esencia",
    "reading.label_image": "Imagen",
    "reading.label_general": "Dictamen",
    "reading.label_lines": "Líneas Activas",
    "reading.label_resulting": "Hexagrama Resultante",
    "reading.no_mutations": "Sin líneas mutantes. La situación es estable.",
    "reading.btn_close": "Cerrar",
    "reading.btn_save": "Guardar",
    "reading.btn_pdf": "PDF",
    "reading.premium_title": "Lectura Taoísta & Acción",
    "reading.premium_questions": "Preguntas Guía",
    "reading.premium_action": "Micro-Acción",
    "reading.teaser_blur_text": "Contenido Premium Contenido Premium Contenido Premium Contenido Premium",
    "reading.teaser_overlay": "Desbloquear Lectura Completa",
    "history.title": "Historial",
    "history.badge_full": "Ilimitado",
    "history.badge_limited": "Gratis (Reciente)",
    "history.btn_view": "Ver",
    "history.btn_back": "Volver",
    "history.btn_clear": "Borrar Todo",
    "history.empty": "No hay consultas guardadas.",
    "history.locked_banner": "Y {count} sesiones más guardadas...",
    "history.modal_saved_title": "Sesión Guardada",
    "history.modal_saved_body": "Tu consulta se ha guardado en el historial.",
    "history.alert_replaced": "Se ha sobrescrito la sesión anterior (Límite Gratuito).",
    "history.limit_modal_title": "Límite de Historial",
    "history.limit_modal_body": "En la versión gratuita, solo se guarda 1 sesión.",
    "history.limit_modal_question": "¿Deseas desbloquear el historial ilimitado?",
    "history.limit_modal_warning": "Si no, se sobrescribirá la sesión del {date}.",
    "history.btn_upgrade_save": "Mejorar y Guardar",
    "history.btn_overwrite_save": "Sobrescribir",
    "history.modal_cleared_title": "Historial Borrado",
    "history.modal_cleared_body": "Se han eliminado todas las sesiones.",
    "paywall.btn_simulate": "Simular Compra",
    "paywall.btn_revoke": "Revocar Acceso",
    "paywall.btn_back": "Volver",
    "paywall.modal_unlocked": "¡Premium Activado!",
    "paywall.modal_unlocked_body": "Gracias por tu apoyo. Disfruta de todas las funciones.",
    "paywall.modal_locked": "Premium Desactivado",
    "paywall.modal_locked_body": "Has vuelto a la versión gratuita."
  };

  let val = en[key] || key;
  if (params) {
    Object.keys(params).forEach(k => {
      val = val.replace(`{${k}}`, params[k]);
    });
  }
  return val;
}

function opt(val, label) {
  return `<option value="${val}">${label}</option>`;
}

// Global Modal
function openModal(title, content) {
  const m = document.getElementById("modal");
  const tVal = document.getElementById("modalTitle");
  const bVal = document.getElementById("modalBody");
  if (m && tVal && bVal) {
    tVal.textContent = title;
    bVal.innerHTML = content;
    m.showModal();
  }
}

// Removed fallback stubs since we are now importing them directly.
