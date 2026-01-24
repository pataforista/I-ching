const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_ROOT = path.join(ROOT, 'data');
const MANIFEST_PATH = path.join(DATA_ROOT, 'dataset_manifest.json');

console.log('Running Integrity Check...');
console.log(`Root: ${ROOT}`);

function fail(msg) {
    console.error(`[FAIL] ${msg}`);
    process.exit(1);
}

function pass(msg) {
    console.log(`[PASS] ${msg}`);
}

if (!fs.existsSync(MANIFEST_PATH)) fail(`Manifest not found at ${MANIFEST_PATH}`);

let manifest;
try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    pass('Manifest loaded and parsed.');
} catch (e) {
    fail(`Manifest JSON invalid: ${e.message}`);
}

const resources = manifest.resources || [];
if (resources.length === 0) fail('Manifest has no resources.');

let missingCount = 0;

resources.forEach(r => {
    // Normalize path. Manifest paths start with / (e.g. /data/...)
    // We need to map them relative to ROOT.
    // Assumes r.path are local paths unless they contain "http"
    if (r.path.startsWith('http')) {
        console.log(`[INFO] Skipping remote resource: ${r.id}`);
        return;
    }

    // Remove leading slash to join correctly
    const relPath = r.path.startsWith('/') ? r.path.slice(1) : r.path;
    const absPath = path.join(ROOT, relPath);

    if (!fs.existsSync(absPath)) {
        console.error(`[MISSING] Resource ${r.id}: ${absPath} not found.`);
        missingCount++;
    } else {
        // Try to parse if it is json
        if (absPath.endsWith('.json')) {
            try {
                JSON.parse(fs.readFileSync(absPath, 'utf8'));
                // pass(`Resource ${r.id} is valid JSON.`);
            } catch (e) {
                const msg = `[INVALID JSON] Resource ${r.id}: ${e.message}`;
                console.error(msg);
                fs.writeFileSync('integrity_error.log', msg);
                missingCount++;
            }
        }
    }
});

if (missingCount > 0) fail(`Integrity check failed with ${missingCount} errors.`);

pass('All manifest resources exist and are valid JSON.');

// Specific check for hexagrams_core
const coreRes = resources.find(r => r.id === 'editorial_content_core');
if (coreRes) {
    const corePath = path.join(ROOT, coreRes.path.startsWith('/') ? coreRes.path.slice(1) : coreRes.path);
    try {
        const core = JSON.parse(fs.readFileSync(corePath, 'utf8'));
        const hexs = core.hexagrams || core; // Handle both structures
        const count = Object.keys(hexs).length;
        if (count < 64) {
            console.warn(`[WARN] Hexagrams count: ${count} (expected 64). Is this a partial dataset?`);
        } else {
            pass(`Hexagrams content check: ${count} entries found.`);
        }
    } catch (e) {
        fail(`Could not read core content: ${e.message}`);
    }
}

console.log('Integrity check passed successfully.');
process.exit(0);
