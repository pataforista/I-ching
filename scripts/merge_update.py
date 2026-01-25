
import json
from pathlib import Path

def merge_hexagrams():
    root = Path(__file__).resolve().parents[1]
    core_path = root / "data" / "content" / "hexagrams_core.json"
    update_path = root / "data" / "content" / "hexagrams_update_57_64.json"

    print(f"Reading core from {core_path}")
    with core_path.open("r", encoding="utf-8") as f:
        core_data = json.load(f)

    print(f"Reading update from {update_path}")
    with update_path.open("r", encoding="utf-8") as f:
        update_data = json.load(f)

    # Update hexagrams
    if "hexagrams" not in core_data:
        core_data["hexagrams"] = {}

    for k, v in update_data.items():
        print(f"Updating hexagram {k}")
        core_data["hexagrams"][k] = v

    print(f"Writing updated core to {core_path}")
    with core_path.open("w", encoding="utf-8") as f:
        json.dump(core_data, f, indent=2, ensure_ascii=False)

    print("Done.")

if __name__ == "__main__":
    merge_hexagrams()
