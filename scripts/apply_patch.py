
import json
from pathlib import Path

def merge_hexagrams():
    root = Path(__file__).resolve().parents[1]
    core_path = root / "data" / "content" / "hexagrams_core.json"
    patch_path = root / "data" / "content" / "hexagrams_patch_0.1.3.json"

    print(f"Reading core from {core_path}")
    with core_path.open("r", encoding="utf-8") as f:
        core_data = json.load(f)

    print(f"Reading patch from {patch_path}")
    with patch_path.open("r", encoding="utf-8") as f:
        patch_data = json.load(f)

    # Update metadata
    core_data["version"] = patch_data["version"]
    if "editorial_note_es" in patch_data:
        core_data["editorial_note_es"] = patch_data["editorial_note_es"]

    # Update hexagrams
    if "hexagrams" in patch_data:
        for k, v in patch_data["hexagrams"].items():
            print(f"Updating hexagram {k}")
            core_data["hexagrams"][k] = v

    print(f"Writing updated core to {core_path}")
    with core_path.open("w", encoding="utf-8") as f:
        json.dump(core_data, f, indent=2, ensure_ascii=False)

    print("Done.")

if __name__ == "__main__":
    merge_hexagrams()
