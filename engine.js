// engine.js
// Orquestador de datos y lógica.
// Carga datasets desde /data y ejecuta la tirada (3 monedas) + armado de hexagrama.

const DATA_ROOT = "./data";

const store = {
  manifest: null,
  rules: { coins: null, build: null },
  meta: null,
  trigrams: null,
  content: null, // hexagrams_core.json (esperado como objeto con "hexagrams" o directo)
  ready: false,
};

export async function initEngine() {
  // Cargar manifest
  const manifestRes = await fetch(`${DATA_ROOT}/dataset_manifest.json`, { cache: "no-cache" });
  if (!manifestRes.ok) throw new Error("No se pudo cargar dataset_manifest.json");
  store.manifest = await manifestRes.json();

  // Cargar recursos required_for_boot
  const bootResources = store.manifest.resources.filter(r => r.required_for_boot);

  const results = await Promise.all(bootResources.map(async (r) => {
    const path = r.path.startsWith("http") ? r.path : `.${r.path}`;
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error(`No se pudo cargar: ${path}`);
    return { id: r.id, data: await res.json() };
  }));

  results.forEach(({ id, data }) => {
    if (id === "coins_rules") store.rules.coins = data;
    if (id === "hexagram_build_rules") store.rules.build = data;
    if (id === "hexagrams_meta") store.meta = data;
    if (id === "trigrams") store.trigrams = data;
  });

  // cargar contenido editorial en background (no bloquea)
  loadContent().catch(() => {});
  store.ready = true;
  return true;
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
  if (!store.content) throw new Error("Contenido editorial no cargado (aún)");

  if (!Array.isArray(tosses) || tosses.length !== 6) {
    throw new Error("Se requieren 6 líneas");
  }

  // bottom_to_top: tosses[0] = línea 1 (abajo)
  const primaryBits = tosses.map(t => t.line_bit);
  const resultBits  = tosses.map(t => t.transforms_to_bit);

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
    "0,0,1": "gen",  "0,1,1": "xun",  "1,0,1": "li",   "1,1,0": "dui"
  };

  const lowerId = trigramMap[lowerBits.join(",")];
  const upperId = trigramMap[upperBits.join(",")];
  if (!lowerId || !upperId) return null;

  const h = store.meta.hexagrams.find(x => x.lower_trigram === lowerId && x.upper_trigram === upperId);
  return h || null;
}

function hydrateHexagram(metaHex, tosses = null) {
  if (!metaHex) return null;

  const content = store.content.hexagrams[String(metaHex.id)];
  // Permite dataset parcial, pero avisa en UI.
  const safe = content || {
    dynamic_core_es: "Contenido no disponible aún para este hexagrama.",
    image_es: "—",
    general_reading_es: "—",
    lines_es: {},
    taoist_reading_es: "—",
    guiding_questions_es: [],
    micro_action_es: "—",
    ethics_note_es: "—"
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
