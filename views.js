// views.js
// Renderización de vistas HTML — Separación de preocupaciones (UI pura).
// Este módulo solo genera strings HTML a partir del estado. No toca el DOM directamente.
// Para componentes interactivos que requieren el DOM, ver ui-lib.js.

import { t } from "./engine.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function escapeHtml(unsafe) {
  if (typeof unsafe !== "string") return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function opt(val, label, currentMode) {
  return `<option value="${val}" ${currentMode === val ? "selected" : ""}>${label}</option>`;
}

export function renderStageCoins() {
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

export function renderHexLines(tosses) {
  if (tosses.length === 0) return "";
  const items = tosses.map(toss => {
    const val = toss.value || toss.sum || 7;
    const isYin = val % 2 === 0; // 6, 8 = yin; 7, 9 = yang
    const isMoving = toss.is_moving;
    return `<div class="hex-line ${isYin ? 'yin' : 'yang'}${isMoving ? ' moving' : ''}"></div>`;
  }).reverse();
  return `<div class="hex-visual" style="padding:16px 24px; gap:8px;">${items.join("")}</div>`;
}

// ─── Shell ───────────────────────────────────────────────────────────────────

export function BookShellHTML() {
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

// ─── Views ───────────────────────────────────────────────────────────────────

export function HomeFormView(state) {
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
              ${opt("reflexion", t("home.focus_options.reflexion") || "Reflexión general", state.draft.question.mode)}
              ${opt("decision", t("home.focus_options.decision") || "Toma de decisión", state.draft.question.mode)}
              ${opt("relacion", t("home.focus_options.relacion") || "Vínculos y relaciones", state.draft.question.mode)}
              ${opt("trabajo", t("home.focus_options.trabajo") || "Trabajo y proyectos", state.draft.question.mode)}
              ${opt("salud", t("home.focus_options.salud") || "Bienestar y salud", state.draft.question.mode)}
              ${opt("otro", t("home.focus_options.otro") || "Otro", state.draft.question.mode)}
          </select>
        </div>

        <div class="vstack" style="gap:8px;">
          <label class="muted serif" style="font-size:0.85rem; text-transform:uppercase; letter-spacing:0.06em;">${t("home.label_question") || "Pregunta"}</label>
          <textarea id="qText" class="input-field" style="min-height:120px; resize:none;" placeholder="${t("home.placeholder_question") || "¿Qué actitud conviene sostener ante esta situación?"}">${escapeHtml(state.draft.question.text_es || "")}</textarea>
        </div>
      </div>

      <div style="display:flex; justify-content:center; margin-top:8px;">
        <button class="btn btn--primary" id="btn-consultar" style="width:100%; max-width:320px; padding:20px 40px; font-size:1.05rem;">${t("home.btn_toss") || "Tirar Monedas"}</button>
      </div>

      ${state.history.length > 0 ? `
      <div style="text-align:center; margin-top:-10px;">
        <button class="btn btn--ghost" id="btnHistoryShortcut" style="font-size:0.85rem; padding:12px 24px;">Ver historial (${state.history.length})</button>
      </div>
      ` : ''}
    </div>
  `;
}

export function TossView(state) {
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

export function ReadingView(state) {
  if (!state.session) {
    return `<div style="text-align:center; padding:40px 0;"><p class="serif muted">Sin sesión activa. Inicia una nueva consulta.</p></div>`;
  }
  return `<div id="bookFlipContainer"></div>`;
}

/**
 * HistoryView — Vista del historial de consultas.
 *
 * La sección de historial está preparada para el modelo premium.
 * Cuando Firebase Auth esté integrado, `currentUser.isPremium` controlará el acceso.
 * Mientras tanto, el fallback usa `state.entitlements.unlimited_history`.
 *
 * @param {object} state - Estado global de la app
 * @param {object} currentUser - Objeto de usuario (ver auth.js)
 */
export function HistoryView(state, currentUser) {
  // Fallback: entitlements locales hasta que Firebase Auth esté activo
  const isPremium = (state.entitlements?.unlimited_history ?? false) ||
                    (currentUser?.isPremium ?? false);

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

      <div class="vstack" style="gap:12px; position:relative;">
        <div class="${isPremium ? '' : 'premium-locked'}">
          ${state.history.length
            ? items
            : `<div class="card muted serif" style="text-align:center; padding:40px;">Aún no has guardado ninguna reflexión.</div>`
          }
        </div>
        ${!isPremium ? PremiumGateHTML("Historial Ilimitado", "Guarda y revisa todas tus consultas pasadas.") : ''}
      </div>

      <div class="hstack" style="justify-content:center; gap:16px; flex-wrap:wrap;">
        <button class="btn btn--primary" id="btnBackHome2">Regresar</button>
        ${state.history.length && isPremium ? `<button class="btn btn--ghost" id="btnClearHistory">Limpiar todo</button>` : ""}
      </div>
    </div>
  `;
}

/**
 * Bloque reutilizable de paywall Premium.
 * Se superpone al contenido bloqueado cuando `currentUser.isPremium` es false.
 * El botón `id="btn-checkout"` será el punto de entrada a Stripe Checkout.
 */
export function PremiumGateHTML(title = "Función Premium", description = "Activa tu suscripción para acceder.") {
  return `
    <div class="premium-gate">
      <div class="premium-gate__content">
        <div class="seal" style="width:44px; height:44px; margin:0 auto 14px; background:var(--gold); font-size:20px;">★</div>
        <h3 class="serif" style="margin:0 0 8px; font-size:1rem;">${escapeHtml(title)}</h3>
        <p class="muted serif" style="font-size:0.85rem; margin:0 0 20px; line-height:1.6;">${escapeHtml(description)}</p>
        <button class="btn btn--primary" id="btn-checkout">Activar Premium</button>
      </div>
    </div>
  `;
}

export function BootErrorView(state) {
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
