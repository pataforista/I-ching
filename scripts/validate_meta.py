import json

def validate_meta():
    with open('data/hexagrams_meta.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    hexagrams = data['hexagrams']
    ids = [h['id'] for h in hexagrams]
    
    # 1. 64 hexagrams
    if len(hexagrams) != 64:
        print(f"Error: Found {len(hexagrams)} hexagrams, expected 64")
    
    # 2. Sequential IDs 1-64
    if sorted(ids) != list(range(1, 65)):
        print("Error: IDs are not 1-64")
    
    # 3. Pair symmetry
    id_map = {h['id']: h for h in hexagrams}
    for h in hexagrams:
        pid = h['pair']
        if pid not in id_map:
            print(f"Error: Hexagram {h['id']} has invalid pair {pid}")
            continue
        
        pair_hex = id_map[pid]
        if pair_hex['pair'] != h['id']:
            print(f"Error: Asymmetry between {h['id']} and {pid}. {pid} points to {pair_hex['pair']}")

    # 4. Trigram IDs
    valid_trigrams = {"qian", "kun", "zhen", "kan", "gen", "xun", "li", "dui"}
    for h in hexagrams:
        if h['upper_trigram'] not in valid_trigrams:
            print(f"Error: Hexagram {h['id']} has invalid upper_trigram {h['upper_trigram']}")
        if h['lower_trigram'] not in valid_trigrams:
            print(f"Error: Hexagram {h['id']} has invalid lower_trigram {h['lower_trigram']}")

    print("Validation complete.")

if __name__ == "__main__":
    validate_meta()
