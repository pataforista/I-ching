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
  getLicenses,
  t
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
    case "home": contentHTML = HomeFormView(); break;
    case "toss": contentHTML = TossView(); break;
    case "reading": contentHTML = ReadingView(); break;
    case "history": contentHTML = HistoryView(); break;
    case "paywall": contentHTML = PaywallView(); break;
    default: contentHTML = HomeFormView();
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
                    Reflexión Local · v1.1 Premium
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
    <div class="vstack" style="gap:40px;">
      <div style="text-align:center;">
         <div class="seal" style="width:50px; height:50px; margin:0 auto; background:var(--indigo);">IC</div>
         <h2 class="hexTitle" style="margin-top:20px;">Nueva Consulta</h2>
         <p class="muted serif">Silencia tu mente y formula tu pregunta con claridad.</p>
      </div>
      
      <div class="vstack" style="gap:30px;">
        <div class="vstack" style="gap:8px;">
          <label class="muted serif">${t("home.label_focus")}</label>
          <select id="qMode" class="input-field">
              ${opt("reflexion", t("home.focus_options.reflexion"))}
              ${opt("decision", t("home.focus_options.decision"))}
              ${opt("relacion", t("home.focus_options.relacion"))}
              ${opt("trabajo", t("home.focus_options.trabajo"))}
              ${opt("salud", t("home.focus_options.salud"))}
              ${opt("otro", t("home.focus_options.otro"))}
          </select>
        </div>

        <div class="vstack" style="gap:8px;">
          <label class="muted serif">${t("home.label_question")}</label>
          <textarea id="qText" class="input-field" style="min-height:120px; resize:none;" placeholder="${t("home.placeholder_question")}">${escapeHtml(state.draft.question.text_es || "")}</textarea>
        </div>
      </div>

      <div class="row" style="justify-content:center; margin-top:20px;">
        <button class="btn btn--primary" id="btnBegin" style="width:100%; max-width:300px;">Iniciar Ritual</button>
      </div>
    </div>
  `;
}

function TossView() {
  const n = state.draft.tosses.length;
  return `
    <div class="vstack" style="gap:30px;">
      <div class="sage-container">
         <div class="sage-avatar">
            <img src="./assets/sage.png" alt="Sage">
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

      <div class="hex-visual" style="margin-top:20px;">
        ${renderHexLines(state.draft.tosses)}
      </div>
    </div>
  `;
}

function renderHexLines(tosses) {
  if (tosses.length === 0) return `<div class="muted serif">El hexagrama se revelará aquí...</div>`;

  return tosses.map((t, idx) => {
    const isYang = t.line_bit === 1;
    const isMoving = t.is_moving;
    return `<div class="hex-line ${isYang ? 'yang' : 'yin'} ${isMoving ? 'moving' : ''}"></div>`;
  }).reverse().join('');
}

function ReadingView() {
  if (!state.session) return `<div class="card"><div class="muted">Sesión no encontrada.</div></div>`;

  const { primary, resulting, is_mutating } = state.session.hexagrams;
  const title = primary ? `${primary.id}. ${primary.hanzi} · ${primary.slug}` : "Desconocido";

  return `
    <div class="vstack" style="gap:40px;">
      <div class="vstack" style="align-items:center; text-align:center;">
        <div class="seal" style="margin-bottom:20px;">${primary?.id || '!!'}</div>
        <h1 class="hexTitle" style="font-size:2.5rem;">${escapeHtml(title)}</h1>
        <div class="badge" style="margin-top:10px;">Enfoque: ${escapeHtml(state.session.question.mode)}</div>
      </div>

      <div class="card" style="background:var(--accent-soft); border:none;">
        <p class="serif" style="font-style:italic; font-size:1.2rem; text-align:center; color:var(--text);">
          “${escapeHtml(state.session.question.text_es)}”
        </p>
      </div>

      <div class="vstack" style="gap:40px;">
        <section>
          <h3 class="muted serif" style="text-transform:uppercase; font-size:0.8rem; letter-spacing:0.1em;">El Dictamen</h3>
          <p style="font-size:1.15rem; font-weight:500;">${escapeHtml(primary?.dynamic_core_es || "—")}</p>
        </section>

        <section>
          <h3 class="muted serif" style="text-transform:uppercase; font-size:0.8rem; letter-spacing:0.1em;">La Imagen</h3>
          <p>${escapeHtml(primary?.image_es || "—")}</p>
        </section>

        <section>
          <h3 class="muted serif" style="text-transform:uppercase; font-size:0.8rem; letter-spacing:0.1em;">Interpretación General</h3>
          <p class="serif" style="white-space:pre-wrap;">${escapeHtml(primary?.general_reading_es || "—")}</p>
        </section>

        ${renderLinesDetail(primary)}
        ${renderResultingSection(is_mutating, resulting)}
        ${renderPremiumReading(primary)}
      </div>

      <div class="hstack" style="justify-content:center; gap:16px; margin-top:40px;">
        <button class="btn btn--primary" id="btnSave">Guardar en mi Memoria</button>
        <button class="btn btn--ghost" id="btnPDF">Exportar PDF</button>
        <button class="btn btn--ghost" id="btnClose">Nueva Consulta</button>
      </div>
    </div>
  `;
}

function renderLinesDetail(hex) {
  if (!hex?.active_lines_content?.length) return "";

  return `
    <div class="divider"></div>
    <section>
      <h3 class="muted serif" style="text-transform:uppercase; font-size:0.8rem; letter-spacing:0.1em;">Líneas en Movimiento</h3>
      <div class="vstack" style="gap:20px; margin-top:20px;">
        ${hex.active_lines_content.map(l => `
          <div class="card" style="padding:24px; border-style:dashed;">
            <div class="muted serif" style="margin-bottom:8px;">Línea ${l.position}</div>
            <p class="serif">${escapeHtml(l.text)}</p>
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
  if (state.entitlements.premium_sections) {
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
  } else {
    return `
      <div class="divider"></div>
      <div class="card" style="text-align:center; padding:60px 40px; border:2px dashed var(--gold);">
        <h3 class="serif">Contenido Reservado</h3>
        <p class="muted serif">Accede a las lecturas taoístas y preguntas de poder.</p>
        <button class="btn btn--primary" style="margin-top:20px;" id="btnUnlockTeaser">Desbloquear Premium</button>
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

  const items = visibleHistory.map((s) => {
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
        
        ${!isUnlimited && lockedCount > 0 ? `
          <div class="card" style="text-align:center; border:1px dashed var(--gold);">
            <p class="muted serif">Y ${lockedCount} consultas más ocultas...</p>
            <button class="btn btn--ghost" id="historyLocked">Liberar Historial Completo</button>
          </div>
        ` : ""}
      </div>

      <div class="hstack" style="justify-content:center; gap:16px;">
        <button class="btn btn--primary" id="btnBackHome2">Regresar</button>
        ${state.history.length ? `<button class="btn btn--ghost" id="btnClearHistory">Limpiar Todo</button>` : ""}
      </div>
    </div>
  `;
}

function PaywallView() {
  const products = getProducts();
  const prod = products?.products?.[0];
  const copy = products?.paywall_copy_es;
  const price = prod?.price?.formatted || "Consultar";

  return `
    <div class="vstack" style="gap:40px; align-items:center; text-align:center;">
      <div class="seal" style="width:80px; height:80px; font-size:32px; background:var(--gold);">★</div>
      
      <div>
        <h2 class="hexTitle" style="font-size:2.5rem;">${escapeHtml(copy?.title || "Versión Premium")}</h2>
        <p class="serif" style="font-size:1.2rem; opacity:0.8; max-width:500px;">
           ${escapeHtml(copy?.body || "Profundiza en tu viaje espiritual con herramientas exclusivas de reflexión.")}
        </p>
      </div>

      <div class="card" style="max-width:400px; width:100%; border:2px solid var(--gold);">
         <div class="vstack" style="gap:24px;">
            <div style="font-size:2rem; font-weight:700;">${price}</div>
            <ul class="serif" style="text-align:left; padding-left:20px; display:flex; flex-direction:column; gap:12px;">
               ${prod?.purchase_notes_es?.map(n => `<li>${escapeHtml(n)}</li>`).join("") || "<li>Funciones premium desbloqueadas</li>"}
            </ul>
            <button class="btn btn--primary" id="btnUnlockNow" style="width:100%;">Desbloquear Ahora</button>
         </div>
      </div>

      <button class="btn btn--ghost" id="btnPaywallBack">Quizás más tarde</button>
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
  const base = `<div class="coin-3d"><div class="coin-face coin-front"></div><div class="coin-face coin-back"></div></div>`;
  return base + base + base;
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

  // Cards 3D effect
  document.querySelectorAll(".card").forEach(el => new TiltCard(el));
}

async function onTossNextLine() {
  if (state._tossing) return;
  const n = state.draft.tosses.length;
  if (n >= 6) return finishToss();

  state._tossing = true;
  render();

  const coins = document.querySelectorAll(".coin-3d");
  coins.forEach(c => c.classList.add("tossing"));

  await new Promise(r => setTimeout(r, 1200));

  try {
    const result = tossLine();
    state.draft.tosses.push(result);
  } catch (e) {
    openModal("Error", e.message);
  }

  state._tossing = false;
  render();
}

function finishToss() {
  try {
    state.session = buildReading(state.draft.tosses);
    state.session.id = cryptoRandomId();
    state.session.created_at_iso = new Date().toISOString();
    state.session.question = { ...state.draft.question };
    state.nav = "reading";
    render();
  } catch (e) {
    openModal("Error", "No se pudo generar la lectura: " + e.message);
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
  root.querySelector("#btnUnlockTeaser")?.addEventListener("click", () => openPaywall("reading_teaser"));

  // History
  root.querySelector("#btnBackHome2")?.addEventListener("click", startNew);
  root.querySelector("#btnClearHistory")?.addEventListener("click", deleteHistory);
  root.querySelector("#historyLocked")?.addEventListener("click", () => openPaywall("history_list"));

  root.querySelectorAll("[data-open]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-open");
      const sess = state.history.find(s => s.id === id);
      if (sess) { state.session = sess; nav("reading"); }
    });
  });

  // Paywall
  root.querySelector("#btnUnlockNow")?.addEventListener("click", unlockPremiumLocal);
  root.querySelector("#btnPaywallBack")?.addEventListener("click", () => nav("home"));
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
    tVal.textContent = title;
    bVal.innerHTML = content;
    m.showModal();
  }
}
