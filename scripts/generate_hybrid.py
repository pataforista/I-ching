
import json
from pathlib import Path

def generate_hybrid():
    root = Path(__file__).resolve().parents[1]
    core_path = root / "data" / "content" / "hexagrams_core.json"
    meta_path = root / "data" / "hexagrams_meta.json"
    output_path = root / "data" / "content" / "hexagrams_hybrid_es.json"

    with core_path.open("r", encoding="utf-8") as f:
        core = json.load(f)
    
    with meta_path.open("r", encoding="utf-8") as f:
        meta = json.load(f)

    hybrid = {
        "version": "1.0.0-hybrid",
        "name_es": "I Ching Híbrido: Wilhelm + Legge + Contemporáneo",
        "editorial_note_es": "Este dataset combina la profundidad simbólica de Richard Wilhelm (dominio público original), la estructura académica de James Legge y una interpretación contemporánea orientada a la reflexión.",
        "hexagrams": {}
    }

    core_hex = core.get("hexagrams", {})
    meta_list = meta.get("hexagrams", [])

    trigram_bits = {
        "qian": "111",
        "kun": "000",
        "kan": "010",
        "li": "101",
        "zhen": "100",
        "xun": "011",
        "gen": "001",
        "dui": "110"
    }

    # Create a lookup for meta
    meta_lookup = {str(m["id"]): m for m in meta_list}

    for i in range(1, 65):
        key = str(i)
        c = core_hex.get(key, {})
        m = meta_lookup.get(key, {})

        upper = m.get("upper_trigram", "")
        lower = m.get("lower_trigram", "")
        binary = trigram_bits.get(lower, "000") + trigram_bits.get(upper, "000")

        hybrid["hexagrams"][key] = {
            "id": i,
            "binary": binary,
            "dynamic_core_es": c.get("dynamic_core_es", f"Esencia del hexagrama {i}."),
            "image_es": c.get("image_es", "Imagen simbólica pendiente."),
            "wilhelm_essence_es": f"Perspectiva de Wilhelm para {m.get('slug', 'Hexagrama ' + key)}. (Resumen pendiente de integración)",
            "legge_commentary_es": f"Comentario de Legge sobre la estructura de {m.get('hanzi', '')}. (Texto académico en proceso)",
            "lines_hybrid_es": {
                str(j): c.get("lines_es", {}).get(str(j), f"Línea {j} en proceso.")
                for j in range(1, 7)
            },
            "general_reading_es": c.get("general_reading_es", "Lectura general en desarrollo."),
            "taoist_reading_es": c.get("taoist_reading_es", "Visión contemplativa."),
            "guiding_questions_es": c.get("guiding_questions_es", ["¿Cómo resuena esto hoy?"]),
            "micro_action_es": c.get("micro_action_es", "Acción mínima recomendada."),
            "ethics_note_es": c.get("ethics_note_es", "Nota sobre el uso ético de esta consulta.")
        }

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(hybrid, f, indent=2, ensure_ascii=False)
    
    print(f"Hybrid dataset generated at {output_path}")

if __name__ == "__main__":
    generate_hybrid()
