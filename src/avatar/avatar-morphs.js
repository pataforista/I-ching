/**
 * avatar-morphs.js
 * SVG path morphing for Fox avatar mouth and eyes.
 * Uses linear interpolation instead of d3-interpolate-path CDN to ensure offline reliability.
 */

// Simple linear path interpolator — works for paths with matching command structures
function lerpPath(pathA, pathB, t) {
    // Extract all numbers from both paths
    const numA = pathA.match(/-?[\d.]+/g)?.map(Number) || [];
    const numB = pathB.match(/-?[\d.]+/g)?.map(Number) || [];

    if (numA.length !== numB.length) return t < 0.5 ? pathA : pathB;

    // Rebuild the path string with interpolated numbers
    let i = 0;
    return pathA.replace(/-?[\d.]+/g, () => {
        const v = numA[i] + (numB[i] - numA[i]) * t;
        i++;
        return v.toFixed(3);
    });
}

export class FoxMorphs {
    constructor(svgRoot) {
        this.root = typeof svgRoot === 'string' ? document.querySelector(svgRoot) : svgRoot;

        // Store canonical path data from SVG attributes
        this.eyePaths = {
            left: {
                open: this._getD('fox-eye-left-open'),
                half: this._getD('fox-eye-left-half'),
                closed: this._getD('fox-eye-left-closed'),
            },
            right: {
                open: this._getD('fox-eye-right-open'),
                half: this._getD('fox-eye-right-half'),
                closed: this._getD('fox-eye-right-closed'),
            }
        };

        this.mouthPaths = {
            neutral: this._getD('fox-mouth-neutral'),
            soft: this._getD('fox-mouth-soft'),
        };

        // Active morph elements (always visible, path data is animated)
        this.leftEyeEl = this._getEl('fox-eye-left-open');
        this.rightEyeEl = this._getEl('fox-eye-right-open');
        this.mouthEl = this._getEl('fox-mouth-neutral');

        // Hide morph shape references in the SVG (they're used only for data)
        ['fox-eye-left-half', 'fox-eye-left-closed',
            'fox-eye-right-half', 'fox-eye-right-closed',
            'fox-mouth-soft'].forEach(id => {
                const el = this._getEl(id);
                if (el) el.style.display = 'none';
            });

        // Track current eye state for delta morphs
        this._eyeState = 'open'; // 'open' | 'closed'
        this._mouthState = 'neutral';

        // RAF for morphing
        this._morphRaf = null;
    }

    _getEl(id) {
        return this.root.querySelector(`#${id}`);
    }

    _getD(id) {
        const el = this._getEl(id);
        return el ? el.getAttribute('d') || '' : '';
    }

    /** Morph a path element from pathA to pathB over `duration` ms */
    _morphElement(el, pathA, pathB, duration) {
        if (!el || !pathA || !pathB) return Promise.resolve();
        return new Promise(resolve => {
            const start = performance.now();

            const step = (now) => {
                const raw = Math.min((now - start) / duration, 1);
                // Ease in-out cubic
                const t = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
                el.setAttribute('d', lerpPath(pathA, pathB, t));
                if (raw < 1) {
                    requestAnimationFrame(step);
                } else {
                    resolve();
                }
            };
            requestAnimationFrame(step);
        });
    }

    async blink(duration = 200) {
        const half = duration / 2;
        const lOpen = this.eyePaths.left.open;
        const lClose = this.eyePaths.left.closed;
        const rOpen = this.eyePaths.right.open;
        const rClose = this.eyePaths.right.closed;

        await Promise.all([
            this._morphElement(this.leftEyeEl, lOpen, lClose, half),
            this._morphElement(this.rightEyeEl, rOpen, rClose, half),
        ]);
        await Promise.all([
            this._morphElement(this.leftEyeEl, lClose, lOpen, half),
            this._morphElement(this.rightEyeEl, rClose, rOpen, half),
        ]);
        this._eyeState = 'open';
    }

    async setEyesClosed() {
        if (this._eyeState === 'closed') return;
        await Promise.all([
            this._morphElement(this.leftEyeEl, this.eyePaths.left.open, this.eyePaths.left.closed, 280),
            this._morphElement(this.rightEyeEl, this.eyePaths.right.open, this.eyePaths.right.closed, 280),
        ]);
        this._eyeState = 'closed';
    }

    async setEyesOpen() {
        if (this._eyeState === 'open') return;
        await Promise.all([
            this._morphElement(this.leftEyeEl, this.eyePaths.left.closed, this.eyePaths.left.open, 280),
            this._morphElement(this.rightEyeEl, this.eyePaths.right.closed, this.eyePaths.right.open, 280),
        ]);
        this._eyeState = 'open';
    }

    async setMouth(shape = 'neutral', duration = 320) {
        if (this._mouthState === shape) return;
        const fromPath = this.mouthPaths[this._mouthState] || this.mouthPaths.neutral;
        const toPath = this.mouthPaths[shape] || this.mouthPaths.neutral;
        await this._morphElement(this.mouthEl, fromPath, toPath, duration);
        this._mouthState = shape;
    }
}
