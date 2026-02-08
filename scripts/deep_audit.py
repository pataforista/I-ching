import json
import os
import re

def audit_all():
    errors = []
    with open('data/content/hexagrams_core.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    hexagrams = data.get('hexagrams', {})
    
    # Very specific placeholders that won't appear in normal Spanish prose
    placeholders = [
        r"FIXME", r"\[\s*\]", r"POR\s+DEFINIR", 
        r"FALTA\s+CONTENIDO", r"^PENDIENTE$", r"^TBD$", r"\[PENDIENTE\]"
    ]
    
    for rid, h in hexagrams.items():
        for field, val in h.items():
            if isinstance(val, list):
                for i, item in enumerate(val):
                    for p in placeholders:
                        if re.search(p, str(item).upper()):
                            errors.append(f"Hex {rid}: {field}[{i}] has placeholder {p}")
            elif isinstance(val, dict):
                for k, v in val.items():
                    for p in placeholders:
                        if re.search(p, str(v).upper()):
                            errors.append(f"Hex {rid}: {field}.{k} has placeholder {p}")
            else:
                for p in placeholders:
                    if re.search(p, str(val).upper()):
                        errors.append(f"Hex {rid}: {field} has placeholder {p}")

    if not errors:
        print("Dataset core checks PASSED (no obvious placeholders).")
    else:
        print(f"FAILED: Found {len(errors)} potential placeholders:")
        for e in errors:
            print(f" - {e}")

if __name__ == "__main__":
    audit_all()
