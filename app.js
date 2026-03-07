import { Typewriter, BlurText, BubbleMenu, InkGalaxy, TiltCard, EnsoLoader, DynamicHexagram, drawHanzi, DynamicAvatar } from "./ui-lib.js";
import { FoxAvatarController } from "./src/avatar/avatar-controller.js";
import { ArtBackground } from "./src/art-background.js";
import {
  initEngine,
  trackEvent,
  tossLine,
  buildReading,
  t,
  getHexagramGlossary
} from "./engine.js";

// Constants
const LS_KEY = "iching_local_v2";
const LS_THEME = "iching_theme_v1";
const LS_AUDIO = "iching_audio_v1";

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
let artBg = null;

function foxLine(text) {
  return `🦊 ${text}`;
}

var state = {
  // Boot status
  boot: { ok: true, missing: [], error: null },

  // Navigation: 'home' | 'toss' | 'reading' | 'history' | 'glossary' | 'daily'
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
  history: [],
  glossaryFilter: "",
  glossaryTrigramFilter: null,

  // Entitlements: app is fully paid — all features unlocked
  entitlements: {
    unlimited_history: true,
    premium_sections: true,
    pdf_export: true,
    full_access: true,
    journal_mode: true,
    export_tools: true
  },
  settings: {
    audio_enabled: true
  }
};

// ---------- Init ----------
(async function init() {
  loadLocal();
  if (!state.history) state.history = [];

  // Sync audio setting from LS
  const savedAudio = localStorage.getItem(LS_AUDIO);
  if (savedAudio !== null) {
    state.settings.audio_enabled = savedAudio === "true";
  }

  // Handle PWA shortcut deep links
  const bootNav = sessionStorage.getItem('iching_boot_nav');
  if (bootNav) {
    sessionStorage.removeItem('iching_boot_nav');
    state.nav = bootNav;
  }

  initBubbleMenu();

  // Init Smooth Scroll (Lenis)
  if (window.Lenis) {
    const lenis = new Lenis({
      duration: 0.95,
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
    grained("#paper-texture", {
      animate: false,
      patternWidth: 100,
      patternHeight: 100,
      grainOpacity: 0.015,
      grainDensity: 0.85,
      grainWidth: 1.0,
      grainHeight: 1.0,
      grainChaos: 0.2,
      grainSpeed: 10
    });
  }

  // Init Ink Galaxy Background
  galaxy = new InkGalaxy({ count: 24 });

  // Init Art Background (ukiyo-e / sumi-e paintings)
  artBg = new ArtBackground();
  if (window.requestIdleCallback) {
    requestIdleCallback(() => artBg.init(), { timeout: 1200 });
  } else {
    setTimeout(() => artBg.init(), 200);
  }

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

  // Signal splash screen to hide
  document.dispatchEvent(new CustomEvent('app-ready'));
})();

function initBubbleMenu() {
  const hasSub = localStorage.getItem("iching_notifications") === "true";
  bubbleMenu = new BubbleMenu({
    items: [
      { id: "home", icon: "✦", label: "Nueva consulta", onClick: () => startNew() },
      { id: "history", icon: "◎", label: "Mi bitácora", onClick: () => openHistory() },
      { id: "audio", icon: state.settings.audio_enabled ? "🔊" : "🔇", label: state.settings.audio_enabled ? "Silenciar sonidos" : "Activar sonidos", onClick: () => onToggleAudio() },
      { id: "theme", icon: "◑", label: "Cambiar tema", onClick: () => onToggleTheme() },
      {
        id: "notify", icon: hasSub ? "◉" : "○", label: hasSub ? "Silenciar recordatorio" : "Activar recordatorio", onClick: async () => {
          if (!("Notification" in window)) {
            openModal("Notificaciones", "<p class='serif'>Tu navegador no soporta notificaciones.</p>");
            return;
          }
          if (Notification.permission === "granted") {
            const current = localStorage.getItem("iching_notifications") === "true";
            localStorage.setItem("iching_notifications", current ? "false" : "true");
            openModal("Recordatorios", `<p class='serif'>Recordatorios ${current ? 'desactivados' : 'activados'}.</p>`);
            if (bubbleMenu && bubbleMenu.items) {
              bubbleMenu.items[3].icon = !current ? "◉" : "○";
              bubbleMenu.items[3].label = !current ? "Silenciar recordatorio" : "Activar recordatorio";
              bubbleMenu.render();
            }
          } else if (Notification.permission !== "denied") {
            const perm = await Notification.requestPermission();
            if (perm === "granted") {
              localStorage.setItem("iching_notifications", "true");
              new Notification("I Ching — Sabiduría Taoísta", { body: "El oráculo te recordará tu momento de reflexión." });
              if (bubbleMenu && bubbleMenu.items) {
                bubbleMenu.items[3].icon = "◉";
                bubbleMenu.items[3].label = "Silenciar recordatorio";
                bubbleMenu.render();
              }
            }
          }
        }
      },
      {
        id: "about", icon: "ℹ", label: "Acerca de", onClick: () => {
          openModal("I Ching · Guía Taoísta", `
            <div class="serif" style="text-align:center; padding:10px 0;">
              <p><strong>Versión 1.0.0</strong></p>
              <p style="font-size:0.9rem; opacity:0.8;">Una herramienta de reflexión profunda basada en el Libro de las Mutaciones.</p>
              <hr style="opacity:0.1; margin:16px 0;">
              <p style="font-size:0.85rem;"><strong>Contenido Tradicional:</strong> Basado en las obras de dominio público de Richard Wilhelm (1924) y James Legge (1882).</p>
              <p style="font-size:0.85rem;"><strong>Soporte:</strong> <a href="mailto:miniappsminisoluciones@gmail.com">miniappsminisoluciones@gmail.com</a></p>
              <p style="font-size:0.85rem; margin-top:16px;"><a href="./privacy.html" target="_blank">Política de Privacidad</a></p>
            </div>
          `);
        }
      },
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

// ---------- Micro-Interactions ----------
/**
 * Attaches a CSS ripple to every .btn element in the document.
 * Each click spawns a temporary ripple span that animates out then removes itself.
 */
function attachRipple() {
  document.querySelectorAll('.btn').forEach(btn => {
    if (btn.dataset.ripple) return; // already attached
    btn.dataset.ripple = '1';
    btn.style.position = btn.style.position || 'relative';
    btn.style.overflow = 'hidden';
    btn.addEventListener('click', e => {
      const rect = btn.getBoundingClientRect();
      const r = document.createElement('span');
      r.style.cssText = `
        position:absolute;
        border-radius:50%;
        width:4px;height:4px;
        background:hsla(0,0%,100%,0.35);
        left:${e.clientX - rect.left}px;
        top:${e.clientY - rect.top}px;
        transform:translate(-50%,-50%) scale(0);
        pointer-events:none;
        animation: ripple-spread 0.55s cubic-bezier(0,0.5,0.5,1) forwards;
      `;
      btn.appendChild(r);
      r.addEventListener('animationend', () => r.remove());
    });
  });
}

/**
 * Stagger-animates cards within a container by setting --stagger-i custom property.
 */
function staggerCards(selector = '.history-card', baseDelay = 0.05) {
  document.querySelectorAll(selector).forEach((el, i) => {
    el.style.setProperty('--stagger-i', i);
    el.style.animationDelay = `${(i * baseDelay).toFixed(2)}s`;
    el.style.opacity = el.style.opacity || '0';
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.16,1,0.3,1)';
      el.style.transform = 'translateY(16px)';
      requestAnimationFrame(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });
    });
  });
}

// ---------- SW ----------
async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('./sw.js');
  } catch { /* silent */ }
}

// ---------- Haptic ----------
function haptic(type = 'light') {
  if (!navigator.vibrate) return;
  const patterns = { light: [8], medium: [18], heavy: [35], success: [8, 50, 18] };
  navigator.vibrate(patterns[type] || patterns.light);
}

// ---------- Read Progress Bar ----------
function initReadProgress() {
  let bar = document.getElementById('read-progress');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'read-progress';
    document.body.appendChild(bar);
  }

  if (state.nav !== 'reading') {
    bar.style.width = '0%';
    bar.classList.remove('visible');
    return;
  }

  bar.classList.add('visible');
  const content = document.querySelector('.reading-content');
  if (!content) return;

  const onScroll = () => {
    const scrollable = content.scrollHeight - content.clientHeight;
    if (scrollable <= 0) return;
    const pct = Math.min(100, (content.scrollTop / scrollable) * 100);
    bar.style.width = `${pct}%`;
  };

  content.addEventListener('scroll', onScroll, { passive: true });
  // Also watch window scroll for immersive screens
  window.addEventListener('scroll', onScroll, { passive: true });
}

// ---------- Swipe Gesture Navigation ----------
function initSwipeGestures() {
  const SWIPE_THRESHOLD = 60;
  const EDGE_ZONE = 25; // pixels from left/right edge
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;

  // Create swipe hint element if not exists
  let hint = document.querySelector('.swipe-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.className = 'swipe-hint';
    document.body.appendChild(hint);
  }

  // Remove old listeners by replacing element
  document.body.removeEventListener('touchstart', document.body._swipeStart);
  document.body.removeEventListener('touchend', document.body._swipeEnd);

  document.body._swipeStart = (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();

    // Show hint on left edge
    if (touchStartX < EDGE_ZONE && (state.nav === 'reading' || state.nav === 'history' || state.nav === 'glossary' || state.nav === 'daily')) {
      hint.classList.add('active');
    }
  };

  document.body._swipeEnd = (e) => {
    hint.classList.remove('active');
    // Si es un simple "tap" no interumpir
    if (e.changedTouches.length === 0) return;

    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
    const elapsed = Date.now() - touchStartTime;

    // Must be a fast, mostly horizontal gesture. Si tardó mucho o es vertical, o si se movió muy poco, considerarlo tap.
    if (elapsed > 500 || dy > 60 || Math.abs(dx) < SWIPE_THRESHOLD) return;

    // Right swipe from left edge → go back
    if (dx > SWIPE_THRESHOLD && touchStartX < EDGE_ZONE) {
      haptic('light');
      if (state.nav === 'reading') startNew();
      else if (state.nav === 'history') startNew();
      else if (state.nav === 'glossary') startNew();
      else if (state.nav === 'daily') startNew();
      else if (state.nav === 'toss') startNew();
    }

    // Left swipe → advance (toss screen only)
    if (dx < -SWIPE_THRESHOLD && state.nav === 'toss') {
      const tossBtn = document.getElementById('btnToss');
      const finishBtn = document.getElementById('btnFinish');
      if (finishBtn) { haptic('medium'); finishToss(); }
      else if (tossBtn && !state._tossing) { haptic('light'); onTossNextLine(); }
    }
  };
  document.body.addEventListener('touchstart', document.body._swipeStart, { passive: true });
  document.body.addEventListener('touchend', document.body._swipeEnd, { passive: true });
}

// ---------- Sensory Feedback ----------
let audioCtx;

function onToggleAudio() {
  state.settings.audio_enabled = !state.settings.audio_enabled;
  localStorage.setItem(LS_AUDIO, state.settings.audio_enabled);

  // Update bubble menu if open
  if (bubbleMenu && bubbleMenu.items) {
    const audioItem = bubbleMenu.items.find(i => i.id === "audio");
    if (audioItem) {
      audioItem.icon = state.settings.audio_enabled ? "🔊" : "🔇";
      audioItem.label = state.settings.audio_enabled ? "Silenciar sonidos" : "Activar sonidos";
      bubbleMenu.render();
    }
  }

  render();
}

function playTossFeedback() {
  if (!state.settings.audio_enabled) return;

  // Haptic vibration: a fluttery pattern mimicking shaking and landing coins
  if (navigator.vibrate) {
    navigator.vibrate([15, 40, 25, 60, 15, 80, 40]);
  }

  // Synthesize a kinder, softer "Singing Bowl" tone using Web Audio API
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const t = audioCtx.currentTime;

    const playZenBowl = (time, freq, volume, duration) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      // Ultra-soft attack and very long, peaceful decay
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(volume, time + 0.1); // slow fade in
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.start(time);
      osc.stop(time + duration + 0.1);
    };

    // A harmonious, gentle chord (Low, Med, High resonant tones)
    playZenBowl(t, 440, 0.15, 2.5);  // Root
    playZenBowl(t + 0.1, 660, 0.08, 2.0); // Fifth
    playZenBowl(t + 0.2, 880, 0.05, 1.5); // Octave
  } catch (e) {
    console.warn("Audio feedback unavailable", e);
  }
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

  // Crossfade to new artwork on each screen change
  if (artBg) artBg.transition();

  if (to === "home") dispatchFox('OPEN_SCREEN');
  else if (to === "toss") dispatchFox('SHOW_ORACLE');
  else if (to === "reading") dispatchFox('SHOW_READING');
  else if (to === "history") dispatchFox('SLEEP_MODE');
  else if (to === "glossary") dispatchFox('SHOW_READING');
  else if (to === "daily") dispatchFox('SHOW_READING');

  // Premium: progress bar + swipe gestures on each screen
  initReadProgress();
  initSwipeGestures();

  overlay.classList.remove("active");
  overlay.classList.add("fade-out");
  setTimeout(() => overlay.remove(), 600);
}

// ---------- Actions ----------
function startNew() {
  state.draft = {
    question: { text_es: "", mode: "reflexion" },
    tosses: [],
    tossMode: "digital",
    manualCoins: ["heads", "heads", "heads"]
  };
  state.session = null;
  nav("home");
}

function beginToss() {
  dispatchFox('START_SESSION');
  state.draft.tosses = [];
  state.draft.tossMode = "digital";
  state.draft.manualCoins = ["heads", "heads", "heads"];
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

function openGlossary() {
  nav("glossary");
}

function openDailyHexagram() {
  nav("daily");
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
    case "glossary": contentHTML = GlossaryView(); break;
    case "daily": contentHTML = DailyHexagramView(); break;
    default: contentHTML = HomeFormView();
  }

  root.innerHTML = `<div class="immersive-shell fade-in">${contentHTML}</div>`;

  bindPageEvents(root);
  initPageEffects();
  renderDynamicVisuals();

  // Premium micro-interactions
  requestAnimationFrame(() => {
    attachRipple();
    if (state.nav === 'history') staggerCards('.history-card', 0.06);
  });
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

// No book shell — views render directly into immersive-shell

function buildGlossaryModalHTML() {
  const glossary = getHexagramGlossary();
  if (!glossary.length) {
    return `<p class="serif">No se pudo cargar el glosario por ahora.</p>`;
  }

  const items = glossary.map((hex) => `
    <article style="padding:10px 0; border-bottom:1px solid hsla(240,6%,12%,0.08);">
      <div style="display:flex; align-items:baseline; gap:8px; flex-wrap:wrap;">
        <span style="font-weight:700; font-size:0.95rem;">#${hex.id}</span>
        <span style="font-size:1.2rem; line-height:1;">${escapeHtml(hex.hanzi || '')}</span>
        <span class="serif" style="font-weight:600;">${escapeHtml(hex.name_es || '')}</span>
        ${hex.pinyin ? `<span class="muted serif" style="font-size:0.78rem;">(${escapeHtml(hex.pinyin)})</span>` : ''}
      </div>
      <p class="serif" style="margin:8px 0 0; font-size:0.85rem; opacity:0.85; line-height:1.55;">${escapeHtml((hex.teaser_es || '').slice(0, 190))}${hex.teaser_es && hex.teaser_es.length > 190 ? '...' : ''}</p>
    </article>
  `).join('');

  return `
    <div style="max-height:min(70vh,640px); overflow:auto; padding-right:4px;">
      <p class="serif muted" style="font-size:0.82rem; margin:0 0 10px;">Glosario resumido de los 64 hexagramas.</p>
      ${items}
      <p class="serif" style="margin:14px 0 0; font-size:0.8rem; opacity:0.7;">Contacto: <a href="mailto:miniappsminisoluciones@gmail.com">miniappsminisoluciones@gmail.com</a></p>
    </div>
  `;
}

function getHexagramOfDay() {
  const glossary = getHexagramGlossary();
  if (!glossary.length) return null;

  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now - startOfYear) / 86400000) + 1;
  const idx = dayOfYear % glossary.length;
  return glossary[idx];
}

function GlossaryView() {
  const glossary = getHexagramGlossary();
  if (!glossary.length) {
    return `
      <section class="immersive-screen" style="padding-top:42px;">
        <div class="history-wrapper" style="max-width:920px; width:min(100%, 920px);">
          <h2 class="hexTitle" style="margin:0 0 12px;">Glosario de Hexagramas</h2>
          <p class="serif">No se pudo cargar el glosario por ahora.</p>
          <button class="btn btn--ghost" id="btnBackHome3">Volver</button>
        </div>
      </section>
    `;
  }

  const filterRaw = (state.glossaryFilter || "").trim().toLowerCase();
  const filtered = glossary.filter((hex) => {
    // Text search
    let matchText = true;
    if (filterRaw) {
      const haystack = `${hex.id} ${hex.hanzi || ''} ${hex.name_es || ''} ${hex.pinyin || ''} ${hex.teaser_es || ''}`.toLowerCase();
      matchText = haystack.includes(filterRaw);
    }

    // Trigram filter
    let matchTrigram = true;
    if (state.glossaryTrigramFilter) {
      matchTrigram = (hex.upper_trigram === state.glossaryTrigramFilter || hex.lower_trigram === state.glossaryTrigramFilter);
    }

    return matchText && matchTrigram;
  });

  const cards = filtered.map((hex) => `
    <article class="history-card" style="padding:14px 16px;">
      <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
        <div>
          <div style="display:flex; gap:8px; align-items:baseline; flex-wrap:wrap;">
            <span style="font-weight:700;">#${hex.id}</span>
            <span style="font-size:1.3rem; line-height:1;">${escapeHtml(hex.hanzi || '')}</span>
            <span class="serif" style="font-weight:600;">${escapeHtml(hex.name_es || '')}</span>
          </div>
          ${hex.pinyin ? `<p class="muted serif" style="margin:4px 0 0; font-size:0.78rem;">${escapeHtml(hex.pinyin)}</p>` : ''}
        </div>
        <button class="btn btn--ghost" data-open-hex="${hex.id}" style="padding:8px 12px; font-size:0.78rem;">Ver</button>
      </div>
      <p class="serif" style="margin:10px 0 0; font-size:0.84rem; line-height:1.6;">${escapeHtml((hex.teaser_es || '').slice(0, 210))}${hex.teaser_es && hex.teaser_es.length > 210 ? '...' : ''}</p>
    </article>
  `).join('');

  return `
    <section class="immersive-screen" style="padding-top:42px;">
      <div class="history-wrapper" style="max-width:920px; width:min(100%, 920px);">
        <div style="display:flex; justify-content:space-between; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:10px;">
          <h2 class="hexTitle" style="margin:0;">Glosario de Hexagramas</h2>
          <button class="btn btn--ghost" id="btnBackHome3" style="padding:9px 14px;">Volver</button>
        </div>
        <p class="muted serif" style="margin:0 0 14px;">Explora los 64 hexagramas por nombre, número o trigramas.</p>
        <div class="vstack" style="gap:12px; margin-bottom:16px;">
          <input id="glossarySearch" class="input-field" placeholder="Buscar por número, hanzi o nombre..." value="${escapeHtml(state.glossaryFilter || '')}" />
          
          <div class="trigram-filter-bar" id="trigramFilters">
            <button class="trigram-btn ${!state.glossaryTrigramFilter ? 'active' : ''}" data-trigram="null" title="Todos">
              <span>All</span>
            </button>
            <button class="trigram-btn ${state.glossaryTrigramFilter === 'qian' ? 'active' : ''}" data-trigram="qian" title="Cielo / Qian">
              <span>☰</span><small>Cielo</small>
            </button>
            <button class="trigram-btn ${state.glossaryTrigramFilter === 'kun' ? 'active' : ''}" data-trigram="kun" title="Tierra / Kun">
              <span>☷</span><small>Tierra</small>
            </button>
            <button class="trigram-btn ${state.glossaryTrigramFilter === 'kan' ? 'active' : ''}" data-trigram="kan" title="Agua / Kan">
              <span>☵</span><small>Agua</small>
            </button>
            <button class="trigram-btn ${state.glossaryTrigramFilter === 'li' ? 'active' : ''}" data-trigram="li" title="Fuego / Li">
              <span>☲</span><small>Fuego</small>
            </button>
            <button class="trigram-btn ${state.glossaryTrigramFilter === 'zhen' ? 'active' : ''}" data-trigram="zhen" title="Trueno / Zhen">
              <span>☳</span><small>Trueno</small>
            </button>
            <button class="trigram-btn ${state.glossaryTrigramFilter === 'xun' ? 'active' : ''}" data-trigram="xun" title="Viento / Xun">
              <span>☴</span><small>Viento</small>
            </button>
            <button class="trigram-btn ${state.glossaryTrigramFilter === 'gen' ? 'active' : ''}" data-trigram="gen" title="Montaña / Gen">
              <span>☶</span><small>Montaña</small>
            </button>
            <button class="trigram-btn ${state.glossaryTrigramFilter === 'dui' ? 'active' : ''}" data-trigram="dui" title="Lago / Dui">
              <span>☱</span><small>Lago</small>
            </button>
          </div>
        </div>
        <div class="history-grid" style="gap:10px;">
          ${cards || `<p class="serif muted">No hay resultados para tu búsqueda.</p>`}
        </div>
      </div>
    </section>
  `;
}

function DailyHexagramView() {
  const hex = getHexagramOfDay();
  if (!hex) {
    return `
      <section class="immersive-screen" style="padding-top:42px;">
        <div class="history-wrapper" style="max-width:760px; width:min(100%, 760px);">
          <h2 class="hexTitle" style="margin:0 0 12px;">Hexagrama del día</h2>
          <p class="serif">No se pudo cargar el hexagrama del día.</p>
          <button class="btn btn--ghost" id="btnBackHome4">Volver</button>
        </div>
      </section>
    `;
  }

  return `
    <section class="immersive-screen" style="padding-top:42px;">
      <div class="history-wrapper" style="max-width:760px; width:min(100%, 760px);">
        <div class="history-card" style="padding:18px;">
          <p class="muted serif" style="margin:0; font-size:0.78rem; text-transform:uppercase; letter-spacing:0.08em;">Hexagrama del día</p>
          <div style="display:flex; align-items:baseline; gap:10px; margin-top:8px; flex-wrap:wrap;">
            <span style="font-weight:700; font-size:1.06rem;">#${hex.id}</span>
            <span style="font-size:2.1rem; line-height:1;">${escapeHtml(hex.hanzi || '')}</span>
            <h2 class="hexTitle" style="margin:0; font-size:1.28rem;">${escapeHtml(hex.name_es || '')}</h2>
          </div>
          ${hex.pinyin ? `<p class="muted serif" style="margin:6px 0 0;">${escapeHtml(hex.pinyin)}</p>` : ''}
          <p class="serif" style="margin:14px 0 0; line-height:1.7;">${escapeHtml(hex.teaser_es || 'Sin descripción disponible.')}</p>
          <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:16px;">
            <button class="btn btn--primary" id="btnDailyOpenGlossary">Explorar glosario</button>
            <button class="btn btn--ghost" id="btnBackHome4">Volver al inicio</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function HomeFormView() {
  const qText = state.draft.question.text_es || "";
  const placeholder = t("home.placeholder_question") || "¿Qué actitud conviene sostener ante esta situación?";

  return `
    <div class="immersive-screen screen-home">
      <!-- Discreet Audio Toggle -->
      <button class="btn btn--ghost" id="btnAudioToggle" style="position:absolute; top:24px; right:24px; z-index:100; padding:10px; border-radius:50%; width:44px; height:44px; opacity:0.5;">
        ${state.settings.audio_enabled ? "🔊" : "🔇"}
      </button>

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
              <textarea id="qText" class="input-field" style="min-height:110px; resize:none;" placeholder="${placeholder}">${escapeHtml(qText)}</textarea>
            </div>

            <button class="btn btn--primary" id="btnBegin" style="width:100%; padding:18px; font-size:1.05rem; margin-top:4px;">
              ${t("home.btn_toss") || "Consultar el Oráculo"}
            </button>
            <button class="btn btn--ghost" id="btnGlossary" style="width:100%; padding:12px 18px; font-size:0.9rem;">
              Glosario de Hexagramas
            </button>
            <button class="btn btn--ghost" id="btnDailyHex" style="width:100%; padding:12px 18px; font-size:0.9rem;">
              Hexagrama del día
            </button>
            <p class="muted serif" style="margin:0; font-size:0.75rem; text-align:center;">Contacto: <a href="mailto:miniappsminisoluciones@gmail.com">miniappsminisoluciones@gmail.com</a></p>
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

        <div style="display:flex; flex-direction:column; align-items:center;">
          <div id="tossAvatarTarget" style="width: clamp(96px, 28vw, 156px); height: clamp(96px, 28vw, 156px); position: relative; z-index: 2;"></div>
          
          <div class="fox-speech-bubble">
            <span class="muted-label">Voz del sabio</span>
            <div class="toss-oracle-text">
              <span id="zenText"></span>
            </div>
          </div>
        </div>

        <!-- Mode toggle -->
        ${!isComplete ? `
        <div class="toss-mode-toggle">
          <button class="toss-mode-btn ${!isManual ? 'active' : ''}" id="btnModeDigital">Digital</button>
          <button class="toss-mode-btn ${isManual ? 'active' : ''}" id="btnModeManual">Física</button>
        </div>
        ` : ''}

        <div style="text-align:center; display:flex; flex-direction:column; align-items:center; gap:4px;">
          <span class="muted serif" style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.12em; opacity:0.5;">
            ${isComplete ? 'Hexagrama completo' : `Línea ${n + 1} de 6`}
          </span>

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
  const hexTitle = `${p.hanzi || ''} · ${p.name_es || (p.slug ? p.slug.charAt(0).toUpperCase() + p.slug.slice(1) : '')}`.trim();
  const hexTitleR = r ? `${r.hanzi || ''} · ${r.name_es || (r.slug ? r.slug.charAt(0).toUpperCase() + r.slug.slice(1) : '')}`.trim() : '';

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
          <p class="muted serif" style="font-size:0.85rem; margin:0;">${escapeHtml(p.pinyin || '')}${p.name_es && p.pinyin ? ' · ' : ''}${escapeHtml(p.name_es || p.name_en_standard || '')}</p>
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
              <p class="muted serif" style="margin:0; font-size:0.8rem;">${escapeHtml(r.name_es || r.name_en_standard || '')}</p>
              <p class="serif" style="margin:0; font-size:0.88rem; opacity:0.8; line-height:1.6;">${escapeHtml((r.dynamic_core_es || '').substring(0, 150))}…</p>
            </div>
          </div>
        </div>
        ` : ''}

        <!-- Perspectiva Tradicional (Wilhelm/Legge) -->
        ${(p.wilhelm_essence_es && !p.wilhelm_essence_es.includes('pendiente')) || (p.legge_commentary_es && !p.legge_commentary_es.includes('proceso')) ? `
        <div class="reveal-section traditional-section">
          <span class="traditional-title">Pedigree Tradicional</span>
          
          ${p.wilhelm_essence_es && !p.wilhelm_essence_es.includes('pendiente') ? `
          <div class="traditional-entry">
            <span class="traditional-label">Richard Wilhelm</span>
            <p class="traditional-text">${escapeHtml(p.wilhelm_essence_es)}</p>
          </div>
          ` : ''}

          ${p.legge_commentary_es && !p.legge_commentary_es.includes('proceso') ? `
          <div class="traditional-entry">
            <span class="traditional-label">James Legge</span>
            <p class="traditional-text">${escapeHtml(p.legge_commentary_es)}</p>
          </div>
          ` : ''}
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
              <button class="btn btn--ghost" id="btnShare" style="font-size:0.88rem;">Compartir</button>
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
  // Use new realistic image assets for Cara (Yang) and Cruz (Yin)
  const yangFace = `<img src="./assets/coin_yang_final.png" alt="Cara (Yang)" />`;
  const yinFace = `<img src="./assets/coin_yin_final.png" alt="Cruz (Yin)" />`;

  return [1, 2, 3].map((_, i) => `
    <div class="coin-3d" style="--toss-dur:${880 + i * 60}ms;">
      <div class="coin-spin-inner" style="position:relative; width:100%; height:100%; transform-style:preserve-3d;">
        <div class="coin-face coin-front">
          ${yangFace}
        </div>
        <div class="coin-face coin-back">
          ${yinFace}
        </div>
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

  // Reacciones al tocar al zorro
  document.addEventListener("fox_poke", () => {
    const zenEl = document.getElementById("zenText");
    if (zenEl && state.nav === "toss" && !state._tossing) {
      const pokes = [
        "El silencio también es una respuesta.",
        "Observo el cambio en todas las cosas.",
        "¿Buscas la verdad o solo confirmación?",
        "Todo fluye, nada permanece.",
        "El sabio señala la luna, no mires el dedo.",
        "Respira, la respuesta ya está en ti."
      ];
      if (sageTyper) sageTyper.cancel();
      sageTyper = new BlurText(zenEl, { delay: 30, animationDuration: 0.6 });
      sageTyper.type(foxLine(pokes[Math.floor(Math.random() * pokes.length)]));
    }
  });
}

function initPageEffects() {
  const zenEl = document.getElementById("zenText");
  if (zenEl) {
    if (sageTyper) sageTyper.cancel();
    // Usa el nuevo BlurText estilo React Bits
    sageTyper = new BlurText(zenEl, { delay: 40, animationDuration: 0.8 });

    const n = state.draft.tosses.length;
    const isManual = state.draft.tossMode === 'manual';
    let msg = "";

    // Frases variadas según la fase de la tirada
    if (n === 0) {
      if (isManual) {
        msg = "Lanza tus propias monedas. Siente su peso, registra el resultado.";
      } else {
        const phrases = [
          "Concentra tu mente en la pregunta... Lanza las monedas cuando sientas calma interior.",
          "El oráculo aguarda tu consulta inicial. Tira las monedas.",
          "Respira profundo. Cuando el silencio se asiente, lanza las monedas.",
          "Una mente serena atrae respuestas claras. Adelante."
        ];
        msg = phrases[Math.floor(Math.random() * phrases.length)];
      }
    } else if (n < 6) {
      if (isManual) {
        msg = `El eco de tu lanzamiento toma forma. Registra la línea ${n + 1}.`;
      } else {
        const phrases = [
          `El oráculo escucha... Línea ${n + 1} de 6. Sostén la pregunta en tu mente.`,
          `La mutación toma forma. Continúa con la línea ${n + 1}.`,
          `Mantén el foco en tu intención. Tira de nuevo para la línea ${n + 1}.`,
          `El tejido del tiempo se despliega. Avanza a la línea ${n + 1}.`
        ];
        msg = phrases[Math.floor(Math.random() * phrases.length)];
      }
    } else {
      const phrases = [
        "El hexagrama está completo. La respuesta del Libro aguarda.",
        "La forma final ha emergido. Adelante.",
        "El ciclo se ha cerrado. Descubramos la lectura."
      ];
      msg = phrases[Math.floor(Math.random() * phrases.length)];
    }

    sageTyper.type(foxLine(msg));
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

  // Trigger sensory feedback (sound and vibration)
  playTossFeedback();

  const ensoEl = document.getElementById("ensoTarget");
  if (ensoEl) new EnsoLoader(ensoEl).show(2000);

  // Fox transitional speech during toss
  const zenEl = document.getElementById("zenText");
  if (zenEl && sageTyper) {
    const tossPhrases = [
      "Las monedas caen en el vacío...",
      "Observando el fluir del Yin y el Yang...",
      "El azar dialoga con el universo...",
      "El cambio se manifiesta..."
    ];
    // Cancel prior text and blur in new text fast
    sageTyper.cancel();
    sageTyper = new BlurText(zenEl, { delay: 25, animationDuration: 0.6 });
    sageTyper.type(foxLine(tossPhrases[Math.floor(Math.random() * tossPhrases.length)]));
  }

  // Small delay so the DOM is painted before we animate
  setTimeout(() => {
    const coinEls = document.querySelectorAll(".coin-3d");
    const spinEls = document.querySelectorAll(".coin-spin-inner");
    const totalTurns = [1440, 1620, 1800]; // multiples of 360 so always ends face-up

    coinEls.forEach((el, i) => {
      el.style.setProperty("--full-spin", `${totalTurns[i] + Math.round(Math.random() * 360)}deg`);
    });

    // Trigger animation (CSS handles timing via --toss-dur)
    coinEls.forEach(el => el.classList.add("tossing"));

    const dur = 880 + 2 * 60 + 80; // max coin dur + small buffer
    setTimeout(() => {
      // Compute the result
      const line = tossLine();
      state.draft.tosses.push(line);

      // Remove animation class, then set final orientation via transition
      coinEls.forEach((el, i) => {
        el.classList.remove("tossing");
        const spinEl = el.querySelector(".coin-spin-inner");
        if (!spinEl) return;
        const isHeads = line.coins[i] === 'heads';
        // The inner was spinning; reset it to show correct face
        spinEl.style.transition = 'transform 0.35s cubic-bezier(0.16,1,0.3,1)';
        spinEl.style.transform = isHeads ? 'rotateY(0deg)' : 'rotateY(180deg)';
      });

      // Brief pause so user sees the result, then advance
      setTimeout(() => {
        state._tossing = false;
        render();
        if (state.draft.tosses.length === 6) {
          const btn = document.getElementById("btnToss");
          if (btn) btn.textContent = t("toss.btn_finish") || "Ver Lectura";
        }
      }, 450);

    }, 1050);
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
  const outcomes = {
    '6': { value: 6, is_moving: true, line_bit: 0, transforms_to_bit: 1, type: 'old_yin' },
    '7': { value: 7, is_moving: false, line_bit: 1, transforms_to_bit: 1, type: 'young_yang' },
    '8': { value: 8, is_moving: false, line_bit: 0, transforms_to_bit: 0, type: 'young_yin' },
    '9': { value: 9, is_moving: true, line_bit: 1, transforms_to_bit: 0, type: 'old_yang' }
  };
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

  root.querySelector("#btnAudioToggle")?.addEventListener("click", () => {
    onToggleAudio();
  });
  root.querySelector("#btnHistoryShortcut")?.addEventListener("click", openHistory);
  root.querySelector("#btnGlossary")?.addEventListener("click", openGlossary);
  root.querySelector("#btnDailyHex")?.addEventListener("click", openDailyHexagram);

  // Glossary page
  root.querySelector("#btnBackHome3")?.addEventListener("click", startNew);
  root.querySelector("#glossarySearch")?.addEventListener("input", (e) => {
    state.glossaryFilter = e.target.value;
    render();
    // Maintain focus - wait for next cycle and set cursor
    setTimeout(() => {
      const input = document.getElementById("glossarySearch");
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }, 0);
  });

  root.querySelector("#trigramFilters")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".trigram-btn");
    if (!btn) return;
    const trigram = btn.dataset.trigram === "null" ? null : btn.dataset.trigram;
    state.glossaryTrigramFilter = trigram;
    render();
  });
  root.querySelectorAll("[data-open-hex]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-open-hex");
      const glossary = getHexagramGlossary();
      const hex = glossary.find(item => String(item.id) === String(id));
      if (!hex) return;
      openModal(`Hexagrama #${hex.id}`, `
        <div>
          <p style="margin:0; font-size:1.2rem;">${escapeHtml(hex.hanzi || '')} · <strong>${escapeHtml(hex.name_es || '')}</strong></p>
          ${hex.pinyin ? `<p class="serif muted" style="margin:4px 0 0;">${escapeHtml(hex.pinyin)}</p>` : ''}
          <p class="serif" style="margin:12px 0 0; line-height:1.65;">${escapeHtml(hex.teaser_es || 'Sin descripción disponible.')}</p>
          
          ${(hex.wilhelm_essence_es && !hex.wilhelm_essence_es.includes('pendiente')) || (hex.legge_commentary_es && !hex.legge_commentary_es.includes('proceso')) ? `
          <div class="modal-traditional">
            <span style="font-size:0.65rem; text-transform:uppercase; letter-spacing:0.1em; color:var(--gold); display:block; margin-bottom:10px;">Fuentes Tradicionales</span>
            
            ${hex.wilhelm_essence_es && !hex.wilhelm_essence_es.includes('pendiente') ? `
            <div style="margin-bottom:12px;">
              <span style="font-weight:600; font-size:0.75rem; opacity:0.6; display:block;">Richard Wilhelm</span>
              <p class="serif" style="font-size:0.88rem; font-style:italic; opacity:0.8; margin:4px 0 0;">${escapeHtml(hex.wilhelm_essence_es)}</p>
            </div>
            ` : ''}

            ${hex.legge_commentary_es && !hex.legge_commentary_es.includes('proceso') ? `
            <div>
              <span style="font-weight:600; font-size:0.75rem; opacity:0.6; display:block;">James Legge</span>
              <p class="serif" style="font-size:0.88rem; font-style:italic; opacity:0.8; margin:4px 0 0;">${escapeHtml(hex.legge_commentary_es)}</p>
            </div>
            ` : ''}
          </div>
          ` : ''}
        </div>
      `);
    });
  });

  // Daily hexagram page
  root.querySelector("#btnBackHome4")?.addEventListener("click", startNew);
  root.querySelector("#btnDailyOpenGlossary")?.addEventListener("click", openGlossary);

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

  root.querySelector("#btnShare")?.addEventListener("click", () => {
    if (navigator.share && state.session && state.session.hexagrams.primary) {
      const p = state.session.hexagrams.primary;
      const title = `I Ching: ${p.hanzi} ${p.name_es || p.slug}`;
      const text = `He consultado el oráculo del I Ching. Mi lectura es el hexagrama ${p.id}: ${title}.\n\n"${p.dynamic_core_es}"`;
      navigator.share({
        title: title,
        text: text,
        url: window.location.href
      }).catch(console.error);
    } else {
      openModal("Compartir", "<p class='serif'>Tu dispositivo no soporta la función de compartir nativa.</p>");
    }
  });

  // Premium Animations: Staggered reveal
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });

    root.querySelectorAll('.reveal-section').forEach(el => observer.observe(el));
  }


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
