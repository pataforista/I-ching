# Checklist detallado para completar el dataset del I Ching

Este checklist sigue el orden recomendado para dejar la app funcional primero y después completar contenido/negocio. Cada bloque incluye:
- **Objetivo**
- **Campos mínimos**
- **Validaciones clave**
- **Cómo usar Gemini / ChatGPT / NotebookLM**

> Referencia de esquema: `dataset.schema.json` y `session.schema.json`.

---

## 0) Preparación (antes de cargar datos)

**Objetivo:** Asegurar una estructura de trabajo coherente y trazable.

- [ ] Crear carpeta de trabajo para fuentes (p. ej. `data/sources/` o externo).
- [ ] Definir convención de nombres para archivos de dataset:
  - `data/dataset_manifest.json`
  - `data/trigrams.json`
  - `data/hexagrams_meta.json`
  - `data/rules/coins_rules.json`
  - `data/rules/hexagram_build_rules.json`
  - `data/content/hexagrams_core_es.json`
  - `data/licenses.json`
  - `data/products.json`
- [ ] Establecer una hoja de control de calidad (QA) con columnas: `archivo`, `campo`, `status`, `notas`, `fuente`.

**Cómo usar IA**
- **Gemini/ChatGPT**: preparar un template de QA en CSV/Google Sheets.
- **NotebookLM**: cargar el esquema y los primeros borradores para detectar inconsistencias.

---

## 1) Dataset manifest (arranque y versionado)

**Objetivo:** Definir qué recursos carga la app y cómo cachearlos.

**Campos mínimos** (schema `dataset_manifest`):
- [ ] `version` (semver)
- [ ] `last_updated_iso` (ISO)
- [ ] `app_shell_config`:
  - [ ] `min_client_version`
  - [ ] `force_refresh_on_version_change`
- [ ] `resources[]`:
  - [ ] `id`, `path`, `type`, `version`, `required_for_boot`, `cache_strategy`
  - [ ] `lazy_load` (opcional)
  - [ ] `description` (opcional)

**Validaciones clave**
- [ ] Semver válido en todos los `version`.
- [ ] `path` coincide con ubicación real.
- [ ] Recursos críticos (`required_for_boot`) incluyen reglas y datos base.

**Cómo usar IA**
- **Gemini**: generar un primer borrador de `resources[]` con rutas reales del repo.
- **ChatGPT**: revisar coherencia de `cache_strategy` vs tipo de recurso.
- **NotebookLM**: validar manifest vs esquema y contra estructura de carpetas.

---

## 2) Reglas del método (coins_rules)

**Objetivo:** Definir interpretación de monedas y líneas móviles.

**Campos mínimos** (schema `coins_rules`):
- [ ] `version`
- [ ] `method` = `three_coins`
- [ ] `coin_values`:
  - [ ] `heads` = 3
  - [ ] `tails` = 2
- [ ] `sum_outcomes` con claves `6`, `7`, `8`, `9`:
  - [ ] `name_es`, `line_bit`, `is_moving`, `transforms_to_bit`
- [ ] `implementation_notes_es` (opcional)
- [ ] `ui_hints_es` (opcional)

**Validaciones clave**
- [ ] `sum_outcomes` cubre 6/7/8/9 sin faltantes.
- [ ] Coherencia entre `line_bit`, `is_moving`, `transforms_to_bit`.

**Cómo usar IA**
- **ChatGPT**: generar texto de `name_es` estandarizado (ej. “seis viejo yin”, etc.).
- **Gemini**: revisar consistencia semántica y proponer notas de implementación.
- **NotebookLM**: comparar con fuentes tradicionales cargadas.

---

## 3) Reglas de construcción (hexagram_build_rules)

**Objetivo:** Establecer cómo construir hexagramas a partir de líneas.

**Campos mínimos** (schema `hexagram_build_rules`):
- [ ] `version`
- [ ] `line_order` = `bottom_to_top`
- [ ] `line_count` = 6
- [ ] `line_encoding` (`yang`=1, `yin`=0)
- [ ] `primary_hexagram` (`source`, `description_es`)
- [ ] `moving_lines` (`definition_es`, `indices_es`)
- [ ] `resulting_hexagram` (`source`, `description_es`)
- [ ] `trigram_extraction` (objeto libre)
- [ ] `hexagram_lookup` (`source`, `key[]`, `return[]`, `collision_rule_es`)
- [ ] `display_rules_es` (objeto libre)
- [ ] `consistency_tests` (objeto libre)

**Validaciones clave**
- [ ] `line_order` y `line_encoding` coinciden con trigramas.
- [ ] `hexagram_lookup.key` usa `[upper_trigram, lower_trigram]`.

**Cómo usar IA**
- **Gemini**: generar descripción en español clara de reglas.
- **ChatGPT**: proponer tests de consistencia (ej. tabla trigramas->hexagrama).
- **NotebookLM**: validar reglas vs fuentes de I Ching.

---

## 4) Trigramas (trigrams)

**Objetivo:** Definir los 8 trigramas con líneas binarias.

**Campos mínimos** (schema `trigrams`):
- [ ] `version`
- [ ] `line_order` = `bottom_to_top`
- [ ] `line_encoding` (`yang`=1, `yin`=0)
- [ ] `trigrams[]` (8 items):
  - [ ] `id` (qian, kun, zhen, kan, gen, xun, li, dui)
  - [ ] `hanzi`
  - [ ] `symbol_unicode`
  - [ ] `name_es`
  - [ ] `binary_lines_bottom_to_top` (3 bits)
  - [ ] `symbol_name_unicode_es` (opcional)
  - [ ] `keywords_es` (opcional)

**Validaciones clave**
- [ ] Los 8 trigramas están presentes y únicos.
- [ ] `binary_lines_bottom_to_top` tiene 3 bits.

**Cómo usar IA**
- **ChatGPT**: generar `name_es`, `keywords_es` y glosario.
- **Gemini**: verificar líneas binarias con fuentes tradicionales.
- **NotebookLM**: comparar definiciones entre documentos.

---

## 5) Metadatos de hexagramas (hexagrams_meta)

**Objetivo:** Definir los 64 hexagramas con trigramas y emparejamiento.

**Campos mínimos** (schema `hexagrams_meta`):
- [ ] `version`
- [ ] `ordering` = `king_wen`
- [ ] `notes_es`
- [ ] `hexagrams[]` (64 items):
  - [ ] `id` (1–64)
  - [ ] `slug`
  - [ ] `hanzi`
  - [ ] `symbol_unicode`
  - [ ] `pair` (id)
  - [ ] `upper_trigram`, `lower_trigram`

**Validaciones clave**
- [ ] Los ids 1–64 están completos y sin duplicados.
- [ ] `pair` es simétrico (A->B, B->A).
- [ ] `upper_trigram`/`lower_trigram` existen en `trigrams`.

**Cómo usar IA**
- **Gemini**: generar tabla inicial King Wen.
- **ChatGPT**: validar `slug` consistentes (sin espacios/acentos problemáticos).
- **NotebookLM**: cruzar hanzi y símbolos con fuentes confiables.

---

## 6) Contenido editorial (hexagrams_core)

**Objetivo:** Proveer el texto completo para renderizado.

**Campos mínimos** (schema `hexagrams_core`):
- [ ] `version`
- [ ] `editorial_note_es`
- [ ] `hexagrams` (mapa por id/slug):
  - [ ] `dynamic_core_es`
  - [ ] `image_es`
  - [ ] `general_reading_es`
  - [ ] `lines_es` (claves `1`–`6`)
  - [ ] `taoist_reading_es`
  - [ ] `guiding_questions_es` (lista)
  - [ ] `micro_action_es`
  - [ ] `ethics_note_es`

**Validaciones clave**
- [ ] Cada hexagrama tiene todas las secciones.
- [ ] `lines_es` incluye 1–6.
- [ ] Contenido en español consistente en tono y longitud.

**Cómo usar IA**
- **ChatGPT**: generar borradores de texto editorial por hexagrama.
- **Gemini**: hacer revisión de estilo y coherencia taoísta.
- **NotebookLM**: validar contra fuentes o documentos base.

---

## 7) Licencias y principios (licenses)

**Objetivo:** Textos legales y de cumplimiento.

**Campos mínimos**:
- [ ] `version`
- [ ] `app_principles_es` (3 textos)
- [ ] `privacy_es` (5 textos + `telemetry_default`)
- [ ] `copyright_es` (3 textos)
- [ ] `store_disclosures_es` (opcional)

**Validaciones clave**
- [ ] Lenguaje legal claro y consistente.
- [ ] `telemetry_default` definido.

**Cómo usar IA**
- **Gemini**: redactar textos legales base.
- **ChatGPT**: adaptar tono y simplificar lenguaje.
- **NotebookLM**: revisar consistencia con principios de la app.

---

## 8) Productos y monetización (products)

**Objetivo:** Definir productos, precios y entitlements.

**Campos mínimos**:
- [ ] `version`
- [ ] `currency_default`
- [ ] `products[]`:
  - [ ] `id`
  - [ ] `type` = `one_time_purchase`
  - [ ] `name_es`
  - [ ] `description_es`
  - [ ] `entitlements[]`
  - [ ] `store_ids` (`android`, `ios`)
- [ ] `entitlement_map`

**Validaciones clave**
- [ ] `entitlements` coinciden con claves en `entitlement_map`.
- [ ] `store_ids` compatibles con tiendas reales.

**Cómo usar IA**
- **ChatGPT**: redactar copy de productos.
- **Gemini**: revisar coherencia entre productos y permisos.
- **NotebookLM**: revisar pricing y nombres.

---

## 9) Sesiones (session.schema.json) — para historial

**Objetivo:** Guardar consultas de usuarios con resultados.

**Campos mínimos**:
- [ ] `version`, `created_at_iso`, `method`
- [ ] `question` (text_es, mode, tags)
- [ ] `tosses[6]` (coins, sum, line_bit, etc.)
- [ ] `primary`, `resulting`
- [ ] `render` (incluye `content_keys`)
- [ ] `entitlements_snapshot`

**Validaciones clave**
- [ ] `tosses` tiene 6 items.
- [ ] `primary.hexagram_id` en 1–64.
- [ ] `render.content_keys` coincide con claves reales del contenido.

**Cómo usar IA**
- **ChatGPT**: generar sesiones de prueba para QA.
- **Gemini**: validar consistencia de líneas móviles.
- **NotebookLM**: revisar coherencia entre pregunta, resultado y contenido.

---

## 10) QA final antes de publicar

- [ ] Validar JSON con `dataset.schema.json` y `session.schema.json`.
- [ ] Verificar que `dataset_manifest` referencia los recursos correctos.
- [ ] Revisar tamaño y consistencia de textos (evitar vacíos).
- [ ] Ejecutar pruebas de consistencia (si existen scripts en `tools/`).
- [ ] Documentar fuentes y licencias de contenido.

**Cómo usar IA**
- **Gemini/ChatGPT**: generar checklist de errores comunes.
- **NotebookLM**: detectar contradicciones entre fuentes internas.

---

## Sugerencia de flujo usando Gemini + ChatGPT + NotebookLM

1. **Gemini**: genera un primer borrador por bloque (por ejemplo, trigramas y hexagramas meta).
2. **ChatGPT**: refina lenguaje, corrige coherencia de nombres/slug, produce variantes.
3. **NotebookLM**: valida contra documentos fuente (PDFs, notas internas) y detecta inconsistencias.
4. **QA manual**: revisión final y validación de esquema JSON.

---

Si quieres, puedo convertir esto en un checklist por archivo con plantillas JSON listas para completar.
