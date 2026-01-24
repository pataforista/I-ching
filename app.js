// app.js
import { initEngine, tossLine, buildReading, isContentLoaded, getProducts, getLicenses, getEntitlements, purchaseLocal, revokeLocal, trackEvent, getTelemetry, t } from "./engine.js";

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
    if (footerText) footerText.textContent = t("app.footer_default"); // Fallback or key? actually principles are static in licenses.json potentially, but let's use i18n for footer.
    // Better: let's use t("app.footer_default") if principle not found.
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
    openModal(t("app.unknown_error"), `
      <p>No pude completar la tirada.</p>
      <p class="mono muted">${escapeHtml(String(e?.message || e))}</p>
    `);
  }
}

function saveSession() {
  if (!state.session) return;

  // Limite de historial (Freemium logic)
  if (!state.entitlements.unlimited_history && state.history.length > 0) {
    // Show Overwrite Decision Modal
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
    }, 50); // slight delay to ensure DOM is ready inside modal
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
  render(); // update history count in buttons if visible
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
  // Use Engine logic now
  // Assuming first product is the one we want
  const prods = getProducts();
  if (prods?.products?.length > 0) {
    const pid = prods.products[0].product_id;
    state.entitlements = purchaseLocal(pid);
    trackEvent("purchase_completed", { product_id: pid });
    render(); // re-render paywall
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
        <div class="callout__title">${t("app.missing_files")}</div>
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
            <div class="hexTitle">${t("app.boot_error_title")}</div>
            <div class="muted">${t("app.boot_error_desc")}</div>
          </div>
        </div>
        <div class="divider"></div>
        <div class="mono muted">${escapeHtml(state.boot.error || t("app.unknown_error"))}</div>
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
            <div class="hexTitle">${t("home.title")}</div>
            <div class="muted">${t("home.subtitle")}</div>
          </div>
          <span class="badge">${state.entitlements.premium_sections ? t("home.badge_premium") : t("home.badge_free")}</span>
        </div>

        <div class="divider"></div>

        <div class="vstack">
          <div>
            <div class="label">${t("home.label_focus")}</div>
            <select id="qMode">
              ${opt("reflexion", t("home.focus_options.reflexion"))}
              ${opt("decision", t("home.focus_options.decision"))}
              ${opt("relacion", t("home.focus_options.relacion"))}
              ${opt("trabajo", t("home.focus_options.trabajo"))}
              ${opt("salud", t("home.focus_options.salud"))}
              ${opt("otro", t("home.focus_options.otro"))}
            </select>
          </div>

          <div>
            <div class="label">${t("home.label_question")}</div>
            <textarea id="qText" placeholder="${t("home.placeholder_question")}">${escapeHtml(state.draft.question.text_es || "")}</textarea>
          </div>

          <div class="row">
            <button class="btn btn--primary" id="btnBegin">${t("home.btn_toss")}</button>
            <button class="btn btn--ghost" id="btnHistory">${t("home.btn_history")} (${state.history.length})</button>
            <button class="btn btn--ghost" id="btnPremium">${state.entitlements.premium_sections ? t("home.btn_your_access") : t("home.btn_unlock")}</button>
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
            <div class="hexTitle">${t("toss.title")}</div>
            <div class="muted">${t("toss.line_counter", { n: n + 1 })}</div>
          </div>
          <span class="badge">${escapeHtml(state.draft.question.mode)}</span>
        </div>
        <div class="divider"></div>
        
        <div class="muted" style="font-style:italic;">“${escapeHtml(state.draft.question.text_es || "—")}”</div>
        
        <div class="divider"></div>

        <div class="vstack">
          ${n === 0 ? `<div class="muted">${t("toss.instruction_initial")}</div>` : renderTosses(n)}
        </div>

        <div class="divider"></div>

        <div class="row">
          <button class="btn btn--primary" id="btnToss">${n < 6 ? t("toss.btn_toss") : t("toss.btn_finish")}</button>
          <button class="btn btn--ghost" id="btnBackHome">${t("toss.btn_cancel")}</button>
        </div>
      </div>
    </section>
  `;
}

function renderTosses(n) {
  return state.draft.tosses.map((toss, idx) => {
    const lineNo = idx + 1;
    const moving = toss.is_moving ? t("toss.moving") : "";
    const bitText = toss.line_bit === 1 ? t("toss.yang") : t("toss.yin");
    const coins = toss.coins.map(c => {
      const isHeads = c === "heads";
      return `<div class="coin ${isHeads ? "coin--yang" : "coin--yin"}">${isHeads ? "●" : "○"}</div>`;
    }).join("");

    return `
      <div class="card" style="background:transparent; padding:10px;">
        <div class="row" style="justify-content:space-between;">
          <div class="muted">${t("toss.line")} ${lineNo}${moving} · ${bitText}</div>
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
          <div class="card" style="background:transparent;">
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
      <div class="card" style="background:var(--panel2);">
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
          <button class="btn btn--ghost" id="btnClose">${t("reading.btn_close")}</button>
          <button class="btn btn--ghost" id="btnSave">${t("reading.btn_save")}</button>
          <button class="btn btn--ghost" id="btnPDF">${t("reading.btn_pdf")}</button>
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
    // Teaser / Soft Gate
    // We grab the first few words if possible, or generic text, and blur the rest.
    const teaser = (hex.taoist_reading_es || "").split(" ").slice(0, 4).join(" ") + "...";

    return `
      <div class="callout" style="cursor:pointer;" id="premiumLocked">
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
    // Note: We can't easily bind the ID here because this is a template string returning HTML.
    // The binding happens in bindCommon or we use an inline onclick if we were lax, but better to use the container ID `premiumLocked`.
  }
}

function HistoryView() {
  // Freemium Logic for History
  const isUnlimited = state.entitlements.unlimited_history;

  let visibleHistory = state.history;
  let lockedCount = 0;

  if (!isUnlimited && state.history.length > 1) {
    // Si tienes más de 1 y eres free, solo mostramos la primera real, y simulamos locked
    visibleHistory = [state.history[0]];
    lockedCount = state.history.length - 1;
  }

  const rows = visibleHistory.map((s) => {
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
          <button class="btn btn--ghost btn--sm" data-open="${escapeHtml(s.id)}">${t("history.btn_view")}</button>
        </div>
      </div>
    `;
  }).join("");

  let upsell = "";
  if (!isUnlimited) {
    upsell = `
       <div class="card" style="background:#f0f0f0; border:1px dashed #ccc; cursor:pointer;" id="historyLocked">
         <div class="row" style="justify-content:center; padding:10px; color:#555;">
            <div>${t("history.locked_banner", { count: lockedCount })}</div>
         </div>
       </div>
     `;
  }

  return `
    <section class="card">
      <div class="vstack">
        <div class="hstack" style="justify-content:space-between;">
          <div class="hexTitle">${t("history.title")}</div>
          <span class="badge">${isUnlimited ? t("history.badge_full") : t("history.badge_limited")}</span>
        </div>
        <div class="divider"></div>
        ${state.history.length ? `<div class="vstack">${rows}</div>` : `<div class="muted">${t("history.empty")}</div>`}
        
        ${upsell}

        <div class="divider"></div>
        <div class="row">
          <button class="btn btn--ghost" id="btnBackHome2">${t("history.btn_back")}</button>
          <button class="btn btn--ghost" id="btnClearHistory">${t("history.btn_clear")}</button>
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
          <button class="btn btn--primary" id="btnUnlockLocal">${t("paywall.btn_simulate")}</button>
          <button class="btn btn--ghost" id="btnLockLocal">${t("paywall.btn_revoke")}</button>
          <button class="btn btn--ghost" id="btnBackHome3">${t("paywall.btn_back")}</button>
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
  root.querySelector("#btnBackHome")?.addEventListener("click", startNew); // Cancelar = startNew

  // Reading
  root.querySelector("#btnClose")?.addEventListener("click", startNew);
  root.querySelector("#btnSave")?.addEventListener("click", saveSession);
  root.querySelector("#btnPDF")?.addEventListener("click", exportPDF);
  root.querySelector("#premiumLocked")?.addEventListener("click", () => {
    trackEvent("feature_locked", { feature_id: "deep_reading" });
    openPaywall("reading");
  });

  // History
  root.querySelector("#btnBackHome2")?.addEventListener("click", () => nav("home"));
  root.querySelector("#btnClearHistory")?.addEventListener("click", deleteHistory);
  root.querySelector("#historyLocked")?.addEventListener("click", () => {
    trackEvent("feature_locked", { feature_id: "history_limit_list" });
    openPaywall("history_limit");
  });
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

  // Format stats for display
  const locks = Object.entries(stats.feature_locks || {}).map(([k, v]) => `${k}: ${v}`).join(", ") || "0";

  const content = `
    <div class="vstack" style="gap:12px;">
      <p><strong>${t("about.reflection_not_prediction")}</strong> ${escapeHtml(principles.non_predictive || "")}</p>
      <div class="callout">
        ${escapeHtml(principles.no_medical_substitution || t("about.no_medical_substitution"))}
      </div>
      <div class="divider"></div>
      <div class="label">${t("about.stats_title")}</div>
      <div class="vstack" style="gap:4px; font-size:13px; font-family:monospace;">
          <div class="row" style="justify-content:space-between"><span>${t("about.stats_sessions")}:</span> <b>${stats.sessions || 0}</b></div>
          <div class="row" style="justify-content:space-between"><span>${t("about.stats_readings")}:</span> <b>${stats.readings || 0}</b></div>
          <div class="divider"></div>
          <div class="row" style="justify-content:space-between"><span>${t("about.stats_paywall")}:</span> <b>${stats.paywall_views || 0}</b></div>
          <div class="row" style="justify-content:space-between"><span>${t("about.stats_conversions")}:</span> <b>${stats.conversions || 0}</b></div>
          <div class="row" style="justify-content:space-between"><span>${t("about.stats_locks")}:</span> <span style="font-size:0.9em">${locks}</span></div>
      </div>
      <div class="divider"></div>
      <p class="muted" style="font-size:12px;">${t("about.footer")}</p>
    </div>
  `;
  openModal(t("about.title"), content);
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
