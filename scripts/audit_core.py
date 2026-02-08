import json

def audit_core():
    with open('data/content/hexagrams_core.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    hexagrams = data['hexagrams']
    missing_hex = []
    missing_lines = []
    missing_fields = []
    
    required_fields = [
        "dynamic_core_es", "image_es", "general_reading_es",
        "lines_es", "taoist_reading_es", "guiding_questions_es",
        "micro_action_es", "ethics_note_es"
    ]
    
    for i in range(1, 65):
        s_id = str(i)
        if s_id not in hexagrams:
            missing_hex.append(s_id)
            continue
        
        hex_data = hexagrams[s_id]
        
        # Check fields
        for field in required_fields:
            if field not in hex_data or not hex_data[field]:
                missing_fields.append(f"Hex {s_id}: field {field}")
        
        # Check lines
        if "lines_es" in hex_data:
            lines = hex_data["lines_es"]
            for l_idx in range(1, 7):
                s_l_idx = str(l_idx)
                if s_l_idx not in lines or not lines[s_l_idx]:
                    missing_lines.append(f"Hex {s_id}: Line {s_l_idx}")

    print(f"Missing Hexagrams: {missing_hex}")
    print(f"Missing Lines: {len(missing_lines)}")
    if missing_lines:
        print(f"First 5 missing lines: {missing_lines[:5]}")
    print(f"Missing Fields: {len(missing_fields)}")
    if missing_fields:
        print(f"First 5 missing fields: {missing_fields[:5]}")

if __name__ == "__main__":
    audit_core()
