/**
 * avatar-morphs.js
 * SVG path morphing for Fox avatar mouth and eyes.
 * Uses linear interpolation instead of d3-interpolate-path CDN to ensure offline reliability.
 */

// Simple linear path interpolator — works for paths with matching command structures
function lerpPath(pathA, pathB, t) {
    const numA = pathA.match(/-?[\d.]+/g)?.map(Number) || [];
    const numB = pathB.match(/-?[\d.]+/g)?.map(Number) || [];

    if (numA.length !== numB.length) return t < 0.5 ? pathA : pathB;

    let i = 0;
    return pathA.replace(/-?[\d.]+/g, () => {
        const v = numA[i] + (numB[i] - numA[i]) * t;
        i++;
        return v.toFixed(3);
    });
}

/** Ease in-out cubic */
function easeInOutCubic(raw) {
    return raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
}

export class FoxMorphs {
    constructor(svgRoot) {
        this.root = typeof svgRoot === 'string' ? document.querySelector(svgRoot) : svgRoot;

        // Store canonical path data from SVG attributes
        this.eyePaths = {
            left: {
                open:   this._getD('fox-eye-left-open'),
                half:   this._getD('fox-eye-left-half'),
                closed: this._getD('fox-eye-left-closed'),
            },
            right: {
                open:   this._getD('fox-eye-right-open'),
                half:   this._getD('fox-eye-right-half'),
                closed: this._getD('fox-eye-right-closed'),
            }
        };

        this.mouthPaths = {
            neutral: this._getD('fox-mouth-neutral'),
            soft:    this._getD('fox-mouth-soft'),
            open:    this._getD('fox-mouth-open'),
        };

        // Active morph elements (always visible)
        this.leftEyeEl  = this._getEl('fox-eye-left-open');
        this.rightEyeEl = this._getEl('fox-eye-right-open');
        this.mouthEl    = this._getEl('fox-mouth-neutral');

        // Iris/pupil elements for blink coverage
        this._irisLeft   = this._getEl('fox-iris-left');
        this._irisRight  = this._getEl('fox-iris-right');
        this._pupilLeft  = this._getEl('fox-pupil-left');
        this._pupilRight = this._getEl('fox-pupil-right');
        this._glintL1    = this._getEl('fox-glint-left-1');
        this._glintL2    = this._getEl('fox-glint-left-2');
        this._glintR1    = this._getEl('fox-glint-right-1');
        this._glintR2    = this._getEl('fox-glint-right-2');

        // Hide morph shape references in the SVG (used for data only)
        [
            'fox-eye-left-half', 'fox-eye-left-closed',
            'fox-eye-right-half', 'fox-eye-right-closed',
            'fox-mouth-soft', 'fox-mouth-open'
        ].forEach(id => {
            const el = this._getEl(id);
            if (el) el.style.display = 'none';
        });

        this._eyeState   = 'open'; // 'open' | 'closed'
        this._mouthState = 'neutral';
        this._morphRaf   = null;
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
                const t = easeInOutCubic(raw);
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

    /** Fade iris/pupil/glints to simulate lid covering the eye */
    _fadeEyeDetails(toOpacity, duration) {
        const els = [
            this._irisLeft, this._irisRight,
            this._pupilLeft, this._pupilRight,
            this._glintL1, this._glintL2,
            this._glintR1, this._glintR2,
        ].filter(Boolean);
        els.forEach(el => {
            el.animate(
                [{ opacity: el.style.opacity || getComputedStyle(el).opacity },
                 { opacity: toOpacity }],
                { duration, fill: 'forwards', easing: 'ease-in-out' }
            );
        });
    }

    async blink(duration = 200) {
        const half = duration / 2;
        const lO = this.eyePaths.left.open,  lC = this.eyePaths.left.closed;
        const rO = this.eyePaths.right.open, rC = this.eyePaths.right.closed;

        // Fade eye details out as lids close
        this._fadeEyeDetails(0, half);
        await Promise.all([
            this._morphElement(this.leftEyeEl,  lO, lC, half),
            this._morphElement(this.rightEyeEl, rO, rC, half),
        ]);
        // Open lids, reveal eye details
        this._fadeEyeDetails(1, half);
        await Promise.all([
            this._morphElement(this.leftEyeEl,  lC, lO, half),
            this._morphElement(this.rightEyeEl, rC, rO, half),
        ]);
        this._eyeState = 'open';
    }

    async setEyesClosed() {
        if (this._eyeState === 'closed') return;
        this._fadeEyeDetails(0, 280);
        await Promise.all([
            this._morphElement(this.leftEyeEl,  this.eyePaths.left.open,  this.eyePaths.left.closed,  280),
            this._morphElement(this.rightEyeEl, this.eyePaths.right.open, this.eyePaths.right.closed, 280),
        ]);
        this._eyeState = 'closed';
    }

    async setEyesOpen() {
        if (this._eyeState === 'open') return;
        this._fadeEyeDetails(1, 280);
        await Promise.all([
            this._morphElement(this.leftEyeEl,  this.eyePaths.left.closed,  this.eyePaths.left.open,  280),
            this._morphElement(this.rightEyeEl, this.eyePaths.right.closed, this.eyePaths.right.open, 280),
        ]);
        this._eyeState = 'open';
    }

    async setMouth(shape = 'neutral', duration = 320) {
        if (this._mouthState === shape) return;
        const fromPath = this.mouthPaths[this._mouthState] || this.mouthPaths.neutral;
        const toPath   = this.mouthPaths[shape]            || this.mouthPaths.neutral;
        await this._morphElement(this.mouthEl, fromPath, toPath, duration);
        this._mouthState = shape;
    }
}
