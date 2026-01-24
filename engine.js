// engine.js
// Orquestador de datos y lógica.
// Carga datasets desde /data y ejecuta la tirada (3 monedas) + armado de hexagrama.

const DATA_ROOT = "./data";

const store = {
  manifest: null,
  rules: { coins: null, build: null },
  meta: null,
  trigrams: null,
  products: null,
  licenses: null,
  content: null,
  ready: false,
  purchases: new Set(),
  telemetry: { sessions: 0, readings: 0, last_active: null }
};

export async function initEngine() {
  let manifestRes;
  try {
    manifestRes = await fetch(`${DATA_ROOT}/dataset_manifest.json`, { cache: "no-cache" });
  } catch (e) {
    throw new Error("Error de red cargando dataset_manifest.json");
  }

  if (!manifestRes.ok) throw new Error("No se pudo cargar dataset_manifest.json (404)");
  store.manifest = await manifestRes.json();

  const bootResources = store.manifest.resources.filter(r => r.required_for_boot);

  const promises = bootResources.map(async (r) => {
    const path = r.path.startsWith("http") ? r.path : `.${r.path}`;
    try {
      const res = await fetch(path, { cache: "no-cache" });
      if (!res.ok) return { id: r.id, path, error: `Status ${res.status}` };
      return { id: r.id, data: await res.json() };
    } catch (e) {
      return { id: r.id, path, error: String(e.message) };
    }
  });

  const results = await Promise.all(promises);

  const failures = results.filter(r => r.error);
  if (failures.length > 0) {
    const err = new Error("Faltan recursos esenciales");
    err.missing = failures.map(f => `${f.id} (${f.path})`);
    throw err;
  }

  results.forEach(({ id, data }) => {
    if (id === "coins_rules") store.rules.coins = data;
    if (id === "hexagram_build_rules") store.rules.build = data;
    if (id === "hexagrams_meta") store.meta = data;
    if (id === "trigrams") store.trigrams = data;
    if (id === "products") store.products = data;
    if (id === "licenses") store.licenses = data;
  });

  // Restore persistence
  try {
    const saved = localStorage.getItem("iching_engine_v0");
    if (saved) {
      const p = JSON.parse(saved);
      if (Array.isArray(p.purchases)) store.purchases = new Set(p.purchases);
      if (p.telemetry) store.telemetry = p.telemetry;
    }
  } catch { }

  loadContent().catch(() => { });
  store.ready = true;
  trackEvent("engine_init", "ok");
  return true;
}

export function getProducts() { return store.products; }
export function getLicenses() { return store.licenses; }

// --- Entitlements ---
export function getEntitlements() {
  const ent = structuredClone(store.products?.default_free_entitlements || {});

  if (store.products?.products) {
    store.products.products.forEach(prod => {
      if (store.purchases.has(prod.product_id)) {
        for (const [key, val] of Object.entries(prod.entitlements || {})) {
          if (val === true) ent[key] = true;
        }
      }
    });
  }
  return ent;
}

export function purchaseLocal(productId) {
  store.purchases.add(productId);
  saveEngineState();
  trackEvent("purchase_simulated", productId);
  return getEntitlements();
}

export function revokeLocal(productId) {
  store.purchases.delete(productId);
  saveEngineState();
  trackEvent("purchase_revoked", productId);
  return getEntitlements();
}

function saveEngineState() {
  localStorage.setItem("iching_engine_v0", JSON.stringify({
    purchases: Array.from(store.purchases),
    telemetry: store.telemetry
  }));
}

// --- Telemetry ---
export function trackEvent(name, data) {
  if (name === "session_start") store.telemetry.sessions++;
  if (name === "reading_view") store.telemetry.readings++;
  store.telemetry.last_active = new Date().toISOString();
  saveEngineState();
}

export function getTelemetry() {
  return store.telemetry;
}

async function loadContent() {
  const resDef = store.manifest.resources.find(r => r.id === "editorial_content_core");
  if (!resDef) return;

  const res = await fetch(`.${resDef.path}`);
  if (!res.ok) throw new Error("No se pudo cargar hexagrams_core.json");
  const json = await res.json();

  // Acepta 2 formatos:
  // A) { "hexagrams": { "1": {...}, ... } }
  // B) { "1": {...}, "2": {...} }
  store.content = json.hexagrams ? json : { hexagrams: json };
}

export function isContentLoaded() {
  return !!store.content;
}

export function tossLine() {
  if (!store.ready) throw new Error("Engine not ready");

  const rules = store.rules.coins;
  const coins = [randCoin(), randCoin(), randCoin()];
  const sum = coins.reduce((acc, c) => acc + (c === "heads" ? 3 : 2), 0);

  const outcome = rules.sum_outcomes[String(sum)];
  if (!outcome) throw new Error("coins_rules: sum_outcomes incompleto");

  return { coins, sum, ...outcome };
}

function randCoin() {
  return Math.random() < 0.5 ? "heads" : "tails";
}

export function buildReading(tosses) {
  if (!store.meta) throw new Error("Meta no cargado");
  // Graceful degradation: ya no lanzamos error si falta content
  // if (!store.content) throw new Error("Contenido editorial no cargado (aún)");

  if (!Array.isArray(tosses) || tosses.length !== 6) {
    throw new Error("Se requieren 6 líneas");
  }

  // bottom_to_top: tosses[0] = línea 1 (abajo)
  const primaryBits = tosses.map(t => t.line_bit);
  const resultBits = tosses.map(t => t.transforms_to_bit);

  const primaryHex = findHexagram(primaryBits);
  const hasMoving = tosses.some(t => t.is_moving);
  const resultingHex = hasMoving ? findHexagram(resultBits) : null;

  return {
    primary: hydrateHexagram(primaryHex, tosses),
    resulting: resultingHex ? hydrateHexagram(resultingHex, null) : null,
    is_mutating: hasMoving
  };
}

function findHexagram(bits) {
  const lowerBits = bits.slice(0, 3);
  const upperBits = bits.slice(3, 6);

  const trigramMap = {
    "1,1,1": "qian", "0,0,0": "kun", "1,0,0": "zhen", "0,1,0": "kan",
    "0,0,1": "gen", "0,1,1": "xun", "1,0,1": "li", "1,1,0": "dui"
  };

  const lowerId = trigramMap[lowerBits.join(",")];
  const upperId = trigramMap[upperBits.join(",")];
  if (!lowerId || !upperId) return null;

  const h = store.meta.hexagrams.find(x => x.lower_trigram === lowerId && x.upper_trigram === upperId);
  return h || null;
}

function hydrateHexagram(metaHex, tosses = null) {
  if (!metaHex) return null;

  // Acceso seguro: store.content puede ser null
  const content = store.content ? store.content.hexagrams[String(metaHex.id)] : null;

  // Permite dataset parcial o nulo
  const safe = content || {
    dynamic_core_es: "Cargando contenido...",
    image_es: "—",
    general_reading_es: "Texto no disponible. Revise su conexión o la carpeta /data.",
    lines_es: {},
    taoist_reading_es: "—",
    guiding_questions_es: [],
    micro_action_es: "—",
    ethics_note_es: "Sin datos editoriales."
  };

  let activeLines = [];
  if (tosses && safe.lines_es) {
    tosses.forEach((t, idx) => {
      if (t.is_moving) {
        const pos = idx + 1;
        activeLines.push({
          position: pos,
          text: safe.lines_es[String(pos)] || "—"
        });
      }
    });
  }

  return {
    ...metaHex,
    ...safe,
    active_lines_content: activeLines
  };
}
