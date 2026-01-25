
import json
from pathlib import Path

REQUIRED_CORE_FIELDS = [
    "dynamic_core_es",
    "image_es",
    "general_reading_es",
    "lines_es",
    "taoist_reading_es",
    "guiding_questions_es",
    "micro_action_es",
    "ethics_note_es",
]

def stub_hexagrams():
    root = Path(__file__).resolve().parents[1]
    core_path = root / "data" / "content" / "hexagrams_core.json"

    print(f"Reading core from {core_path}")
    with core_path.open("r", encoding="utf-8") as f:
        core_data = json.load(f)

    hexagrams = core_data.get("hexagrams", {})
    
    missing = []
    for i in range(1, 65):
        key = str(i)
        if key not in hexagrams:
            missing.append(key)
            print(f"Stubbing hexagram {key}")
            hexagrams[key] = {
                "dynamic_core_es": "Content pending.",
                "image_es": "Content pending.",
                "general_reading_es": "Content pending.",
                "lines_es": {str(j): "Content pending." for j in range(1, 7)},
                "taoist_reading_es": "Content pending.",
                "guiding_questions_es": ["Question 1?", "Question 2?", "Question 3?"],
                "micro_action_es": "Action pending.",
                "ethics_note_es": "Note pending."
            }

    if not missing:
        print("No missing hexagrams.")
        return

    core_data["hexagrams"] = hexagrams

    print(f"Writing updated core to {core_path}")
    with core_path.open("w", encoding="utf-8") as f:
        json.dump(core_data, f, indent=2, ensure_ascii=False)

    print("Done.")

if __name__ == "__main__":
    stub_hexagrams()
