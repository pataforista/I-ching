import json
from pathlib import Path
import sys

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


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def validate_meta(meta):
    errors = []
    hexagrams = meta.get("hexagrams")
    if not isinstance(hexagrams, list):
        return ["hexagrams_meta.json: 'hexagrams' debe ser un arreglo."]
    ids = [h.get("id") for h in hexagrams]
    if len(hexagrams) != 64:
        errors.append(f"hexagrams_meta.json: se esperaban 64 entradas, hay {len(hexagrams)}.")
    if any(not isinstance(i, int) for i in ids):
        errors.append("hexagrams_meta.json: todos los ids deben ser enteros.")
    else:
        unique_ids = set(ids)
        if len(unique_ids) != len(ids):
            errors.append("hexagrams_meta.json: ids duplicados.")
        missing = [i for i in range(1, 65) if i not in unique_ids]
        if missing:
            errors.append(f"hexagrams_meta.json: faltan ids {missing}.")
    return errors


def validate_core(core):
    errors = []
    hexagrams = core.get("hexagrams")
    if not isinstance(hexagrams, dict):
        return ["hexagrams_core.json: 'hexagrams' debe ser un objeto."]

    keys = list(hexagrams.keys())
    expected = [str(i) for i in range(1, 65)]
    if sorted(keys, key=lambda x: int(x)) != expected:
        missing = [k for k in expected if k not in keys]
        extra = [k for k in keys if k not in expected]
        if missing:
            errors.append(f"hexagrams_core.json: faltan claves {missing}.")
        if extra:
            errors.append(f"hexagrams_core.json: claves inesperadas {extra}.")

    for key in expected:
        data = hexagrams.get(key)
        if not isinstance(data, dict):
            errors.append(f"hexagrams_core.json: hexagrama {key} no es objeto.")
            continue
        for field in REQUIRED_CORE_FIELDS:
            if field not in data:
                errors.append(f"hexagrams_core.json: hexagrama {key} sin '{field}'.")
        lines = data.get("lines_es")
        if not isinstance(lines, dict):
            errors.append(f"hexagrams_core.json: hexagrama {key} lines_es debe ser objeto.")
        else:
            line_keys = list(lines.keys())
            expected_lines = [str(i) for i in range(1, 7)]
            if sorted(line_keys, key=lambda x: int(x)) != expected_lines:
                errors.append(
                    f"hexagrams_core.json: hexagrama {key} lines_es debe tener claves 1..6."
                )
        questions = data.get("guiding_questions_es")
        if not isinstance(questions, list) or len(questions) != 3:
            errors.append(
                f"hexagrams_core.json: hexagrama {key} guiding_questions_es debe tener 3 elementos."
            )
    return errors


def validate_manifest(manifest, repo_root: Path, core_version: str):
    errors = []
    resources = manifest.get("resources")
    if not isinstance(resources, list):
        return ["dataset_manifest.json: 'resources' debe ser un arreglo."]

    editorial = next((r for r in resources if r.get("id") == "editorial_content_core"), None)
    if not editorial:
        errors.append("dataset_manifest.json: falta resource editorial_content_core.")
    else:
        if editorial.get("version") != core_version:
            errors.append(
                f"dataset_manifest.json: editorial_content_core version {editorial.get('version')} != {core_version}."
            )

    for resource in resources:
        if resource.get("required_for_boot") is True:
            path = resource.get("path")
            if not isinstance(path, str):
                errors.append("dataset_manifest.json: resource con path inválido.")
                continue
            rel_path = path.lstrip("/")
            full_path = repo_root / rel_path
            if not full_path.exists():
                errors.append(
                    f"dataset_manifest.json: required_for_boot falta {path} (esperado {full_path})."
                )
    return errors


def main():
    repo_root = Path(__file__).resolve().parents[1]
    data_root = repo_root / "data"

    meta_path = data_root / "hexagrams_meta.json"
    core_path = data_root / "content" / "hexagrams_core.json"
    manifest_path = data_root / "dataset_manifest.json"

    errors = []

    # Check existence
    for p in [meta_path, core_path, manifest_path]:
        if not p.exists():
            errors.append(f"Missing file: {p}")
    
    if errors:
        print("FAIL")
        for err in errors:
            print(f"- {err}")
        return 1

    meta = load_json(meta_path)
    core = load_json(core_path)
    manifest = load_json(manifest_path)

    errors.extend(validate_meta(meta))
    errors.extend(validate_core(core))
    errors.extend(validate_manifest(manifest, repo_root, core.get("version")))

    if errors:
        print("FAIL")
        for err in errors:
            print(f"- {err}")
        return 1

    print("PASS")
    print("Dataset íntegro y consistente.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
