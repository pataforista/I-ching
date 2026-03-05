// ui-lib.js — Premium UI Component Library for I Ching
// v3.0 — Performance & Premium Polish Edition

// ─── Haptic Helper ───────────────────────────────────────────
function haptic(type = 'light') {
    if (!navigator.vibrate) return;
    const patterns = { light: [10], medium: [20], heavy: [40], success: [10, 50, 20] };
    navigator.vibrate(patterns[type] || patterns.light);
}

// ─── Reduced Motion Guard ────────────────────────────────────
const prefersReducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─── Typewriter ───────────────────────────────────────────────
export class Typewriter {
    constructor(element, options = {}) {
        this.element = typeof element === 'string' ? document.querySelector(element) : element;
        this.options = {
            typingSpeed: 22,
            initialDelay: 0,
            cursor: true,
            cursorChar: '|',
            onComplete: null,
            ...options
        };
        this._cancelled = false;
        this.init();
    }

    init() {
        if (!this.element) return;
        this.element.innerHTML = '';

        this.contentEl = document.createElement('span');
        this.element.appendChild(this.contentEl);

        if (this.options.cursor) {
            this.cursorEl = document.createElement('span');
            this.cursorEl.className = 'typer-cursor';
            this.cursorEl.textContent = this.options.cursorChar;
            this.cursorEl.style.cssText =
                'color:var(--accent); opacity:0.7; animation:cursor-blink 1.1s step-end infinite; margin-left:1px; font-weight:300;';
            this.element.appendChild(this.cursorEl);
        }
    }

    async type(text) {
        if (!this.element) return;
        this._cancelled = false;
        this.contentEl.innerHTML = '';
        if (this.options.initialDelay) await this.delay(this.options.initialDelay);

        // If reduced motion, render instantly
        if (prefersReducedMotion()) {
            this.contentEl.textContent = text;
            if (!this._cancelled && this.options.onComplete) this.options.onComplete();
            return;
        }

        for (let i = 0; i < text.length; i++) {
            if (this._cancelled) break;
            const char = document.createElement('span');
            char.textContent = text.charAt(i);
            char.style.cssText = 'opacity:0; transition:opacity 0.18s ease-out;';
            this.contentEl.appendChild(char);
            void char.offsetWidth;
            char.style.opacity = '1';
            // Natural rhythm: longer pause after punctuation
            const isPunct = '.!?,;:'.includes(text.charAt(i));
            await this.delay(this.options.typingSpeed + (isPunct ? 180 : Math.random() * 15));
        }

        if (!this._cancelled && this.options.onComplete) this.options.onComplete();
    }

    cancel() { this._cancelled = true; }
    delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}

// ─── BubbleMenu ───────────────────────────────────────────────
export class BubbleMenu {
    constructor(itemsOrConfig = [], options = {}) {
        if (!Array.isArray(itemsOrConfig) && typeof itemsOrConfig === 'object') {
            this.items = itemsOrConfig.items || [];
            this.options = { position: 'bottom-right', mainIcon: '☸', ...options, ...itemsOrConfig };
        } else {
            this.items = itemsOrConfig;
            this.options = { position: 'bottom-right', mainIcon: '☸', ...options };
        }
        this.isOpen = false;
        this._clickOutside = null;
        this.render();
    }

    render() {
        // Remove old root if re-rendering
        if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);

        this.root = document.createElement('div');
        this.root.className = 'bubble-menu-root';
        this.root.setAttribute('aria-label', 'Menú de navegación');
        this.root.style.cssText =
            'position:fixed; bottom:clamp(16px,4vw,32px); right:clamp(16px,4vw,32px); z-index:1000; ' +
            'display:flex; flex-direction:column-reverse; align-items:flex-end; gap:12px;';

        // Toggle button
        this.toggleBtn = document.createElement('button');
        this.toggleBtn.className = 'bubble-toggle';
        this.toggleBtn.setAttribute('aria-expanded', 'false');
        this.toggleBtn.setAttribute('aria-label', 'Abrir menú');
        this.toggleBtn.innerHTML = `<span class="bubble-icon-inner">${this.options.mainIcon}</span>`;
        this.toggleBtn.style.cssText =
            'width:56px; height:56px; border-radius:50%; background:var(--text); color:var(--bg); ' +
            'box-shadow:0 8px 24px hsla(0,0%,0%,0.18); display:grid; place-items:center; cursor:pointer; ' +
            'font-size:22px; border:none; transition:all 0.35s cubic-bezier(0.16, 1, 0.3, 1); user-select:none; ' +
            'will-change:transform;';
        this.toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            haptic('light');
            this.toggle();
        });
        this.root.appendChild(this.toggleBtn);

        // Items container
        this.itemsContainer = document.createElement('div');
        this.itemsContainer.style.cssText =
            'display:flex; flex-direction:column; gap:8px; align-items:flex-end;';
        this.root.appendChild(this.itemsContainer);

        this.items.forEach((item, idx) => {
            const btn = document.createElement('button');
            btn.className = 'bubble-btn';
            btn.setAttribute('aria-label', item.label);
            btn.innerHTML =
                `<span class="bubble-btn-label">${item.label}</span>` +
                `<span class="bubble-btn-icon">${item.icon || ''}</span>`;
            btn.style.cssText =
                'display:flex; align-items:center; gap:10px; padding:10px 18px 10px 16px; ' +
                'background:var(--panel-bg); color:var(--text); border:1px solid var(--panel-border); ' +
                'border-radius:100px; cursor:pointer; font-family:var(--font-sans); font-weight:500; ' +
                'font-size:0.85rem; opacity:0; transform:translateX(12px) scale(0.95); ' +
                'transition:all 0.32s cubic-bezier(0.16, 1, 0.3, 1); visibility:hidden; ' +
                'box-shadow:0 4px 16px hsla(0,0%,0%,0.08); white-space:nowrap; ' +
                `transition-delay:${idx * 0.04}s;`;

            btn.addEventListener('click', () => {
                haptic('light');
                this.toggle(false);
                if (item.onClick) item.onClick();
            });

            this.itemsContainer.appendChild(btn);
        });

        document.body.appendChild(this.root);
    }

    toggle(forceState) {
        this.isOpen = forceState !== undefined ? forceState : !this.isOpen;
        const btns = this.itemsContainer.querySelectorAll('.bubble-btn');

        this.toggleBtn.setAttribute('aria-expanded', String(this.isOpen));

        if (this.isOpen) {
            this.toggleBtn.style.transform = 'rotate(135deg) scale(0.92)';
            this.toggleBtn.style.background = 'var(--accent)';
            this.toggleBtn.style.boxShadow = '0 8px 28px hsla(156, 30%, 42%, 0.4)';
            btns.forEach((b, i) => {
                b.style.visibility = 'visible';
                // Stagger via timeout so CSS transition delay kicks in correctly
                setTimeout(() => {
                    b.style.opacity = '1';
                    b.style.transform = 'translateX(0) scale(1)';
                }, i * 30);
            });

            // Click-outside to close
            this._clickOutside = (e) => {
                if (!this.root.contains(e.target)) this.toggle(false);
            };
            setTimeout(() => document.addEventListener('click', this._clickOutside), 50);

        } else {
            this.toggleBtn.style.transform = 'rotate(0deg) scale(1)';
            this.toggleBtn.style.background = 'var(--text)';
            this.toggleBtn.style.boxShadow = '0 8px 24px hsla(0,0%,0%,0.18)';
            btns.forEach(b => {
                b.style.opacity = '0';
                b.style.transform = 'translateX(12px) scale(0.95)';
                setTimeout(() => { if (!this.isOpen) b.style.visibility = 'hidden'; }, 350);
            });

            if (this._clickOutside) {
                document.removeEventListener('click', this._clickOutside);
                this._clickOutside = null;
            }
        }
    }

    destroy() {
        if (this._clickOutside) document.removeEventListener('click', this._clickOutside);
        if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
    }
}

// ─── InkGalaxy ───────────────────────────────────────────────
// Performance: no per-frame ctx.filter; uses pre-rendered offscreen canvas
export class InkGalaxy {
    constructor(options = {}) {
        this.options = {
            count: 24,
            colors: ['hsla(215,51%,31%,0.12)', 'hsla(6,68%,56%,0.09)', 'hsla(40,48%,56%,0.11)'],
            ...options
        };
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.mouseX = window.innerWidth / 2;
        this.mouseY = window.innerHeight / 2;
        this._running = true;
        this._rafId = null;
        this.init();
    }

    init() {
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText =
            'position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none;';
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        this.resize();
        window.addEventListener('resize', () => this.resize(), { passive: true });

        // Only track mouse on desktop — touch handled separately
        if (!('ontouchstart' in window)) {
            window.addEventListener('mousemove', (e) => {
                this.mouseX = e.clientX;
                this.mouseY = e.clientY;
            }, { passive: true });
        }

        this.createParticles();

        if (!prefersReducedMotion()) {
            this.animate();
        } else {
            this._renderStatic();
        }

        // Pause rAF loop when tab is hidden — no wasted GPU cycles
        this._onVisibilityChange = () => {
            if (document.hidden) {
                this._running = false;
                if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
            } else if (!prefersReducedMotion()) {
                this._running = true;
                this.animate();
            }
        };
        document.addEventListener('visibilitychange', this._onVisibilityChange);
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (prefersReducedMotion()) this._renderStatic();
    }

    createParticles() {
        this.particles = [];
        for (let i = 0; i < this.options.count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 60 + Math.random() * (Math.max(this.canvas.width, this.canvas.height) * 0.45);
            this.particles.push({
                x: this.canvas.width / 2 + Math.cos(angle) * radius,
                y: this.canvas.height / 2 + Math.sin(angle) * radius,
                size: 1.5 + Math.random() * 3.5,
                color: this.options.colors[Math.floor(Math.random() * this.options.colors.length)],
                angle,
                radius,
                speed: 0.0005 + Math.random() * 0.0012,
            });
        }
    }

    _renderStatic() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.particles.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
        });
    }

    animate() {
        if (!this._running) return;
        const ctx = this.ctx;
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.particles.forEach(p => {
            p.angle += p.speed;
            const tx = cx + Math.cos(p.angle) * p.radius;
            const ty = cy + Math.sin(p.angle) * p.radius;

            // Subtle mouse repel — only close particles
            let rx = tx, ry = ty;
            const dx = tx - this.mouseX;
            const dy = ty - this.mouseY;
            const dist2 = dx * dx + dy * dy;
            if (dist2 < 22500) { // 150px radius
                const d = Math.sqrt(dist2);
                const force = (150 - d) / 150;
                rx += (dx / d) * force * 18;
                ry += (dy / d) * force * 18;
            }

            ctx.beginPath();
            ctx.arc(rx, ry, p.size, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
        });

        this._rafId = requestAnimationFrame(() => this.animate());
    }

    destroy() {
        this._running = false;
        if (this._rafId) cancelAnimationFrame(this._rafId);
        if (this._onVisibilityChange) document.removeEventListener('visibilitychange', this._onVisibilityChange);
        if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    }
}

// ─── TiltCard ─────────────────────────────────────────────────
export class TiltCard {
    constructor(element, options = {}) {
        this.element = element;
        // Skip on mobile / touch devices (performance) and reduced motion
        if ('ontouchstart' in window || prefersReducedMotion()) return;
        this.options = {
            maxTilt: 5,
            perspective: 1400,
            scale: 1.008,
            speed: 500,
            glare: false,
            ...options
        };
        this.init();
    }

    init() {
        this.element.style.cssText += `;transform-style:preserve-3d;
      transition:transform ${this.options.speed}ms cubic-bezier(0.03,0.98,0.52,0.99);will-change:transform;`;
        this.element.addEventListener('mousemove', (e) => this.onMove(e), { passive: true });
        this.element.addEventListener('mouseleave', () => this.onLeave());
    }

    onMove(e) {
        const rect = this.element.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;
        const tX = (0.5 - py) * this.options.maxTilt;
        const tY = (px - 0.5) * this.options.maxTilt;
        this.element.style.transform =
            `perspective(${this.options.perspective}px) rotateX(${tX}deg) rotateY(${tY}deg) scale3d(${this.options.scale},${this.options.scale},${this.options.scale})`;
    }

    onLeave() {
        this.element.style.transform = `perspective(${this.options.perspective}px) rotateX(0) rotateY(0) scale3d(1,1,1)`;
    }
}

// ─── ShaoYongCircle ───────────────────────────────────────────
export class ShaoYongCircle {
    constructor(container, hexagrams, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.hexagrams = hexagrams;
        this.options = { radius: 200, onHexClick: null, ...options };
        this.init();
    }

    init() {
        if (!this.container) return;
        this.render();
    }

    render() {
        const { radius } = this.options;
        const cx = radius + 50, cy = radius + 50;
        const size = (radius + 50) * 2;

        let html = `<svg viewBox="0 0 ${size} ${size}" class="shaoYongCircle">`;
        html += `<circle cx="${cx}" cy="${cy}" r="${radius + 20}" fill="none" stroke="var(--accent-soft)" stroke-width="1" opacity="0.3"/>`;

        this.hexagrams.forEach((hex, i) => {
            const angle = (i / 64) * Math.PI * 2 - Math.PI / 2;
            const x = cx + radius * Math.cos(angle);
            const y = cy + radius * Math.sin(angle);
            const hexSize = 12, lsp = 2;

            html += `<g class="hex-node" transform="translate(${x - hexSize / 2}, ${y - (hexSize + lsp * 5) / 2})" data-id="${hex.id}" style="cursor:pointer;">`;
            const binary = hex.binary || '000000';
            for (let l = 0; l < 6; l++) {
                const isYang = binary[5 - l] === '1';
                const ly = l * (2 + lsp);
                if (isYang) {
                    html += `<line x1="0" y1="${ly}" x2="${hexSize}" y2="${ly}" stroke="var(--text)" stroke-width="1.5"/>`;
                } else {
                    html += `<line x1="0" y1="${ly}" x2="${hexSize / 2.5}" y2="${ly}" stroke="var(--text)" stroke-width="1.5"/>`;
                    html += `<line x1="${hexSize - hexSize / 2.5}" y1="${ly}" x2="${hexSize}" y2="${ly}" stroke="var(--text)" stroke-width="1.5"/>`;
                }
            }
            html += `<rect x="-2" y="-2" width="${hexSize + 4}" height="${(2 + lsp) * 6}" fill="transparent"/>`;
            html += `</g>`;
        });
        html += `</svg>`;
        this.container.innerHTML = html;

        this.container.querySelectorAll('.hex-node').forEach(node => {
            node.addEventListener('click', () => {
                haptic('light');
                if (this.options.onHexClick) this.options.onHexClick(node.getAttribute('data-id'));
            });
            node.addEventListener('mouseenter', () => {
                node.style.filter = 'drop-shadow(0 0 5px var(--gold))';
            });
            node.addEventListener('mouseleave', () => {
                node.style.filter = 'none';
            });
        });
    }
}

// ─── DynamicHexagram ─────────────────────────────────────────
export class DynamicHexagram {
    constructor(lines, options = {}) {
        this.lines = Array.isArray(lines) ? lines : [0, 0, 0, 0, 0, 0];
        this.options = {
            width: 130,
            strokeWidth: 10,
            lineGap: 16,
            animate: !prefersReducedMotion(),
            animationDuration: 0.55,
            animationBaseDelay: 0.08,
            color: 'currentColor',
            ...options
        };
    }

    render(container) {
        if (!container) return;
        const { width: w, strokeWidth: sw, lineGap, animate, animationDuration, animationBaseDelay, color } = this.options;
        const totalH = 6 * sw + 5 * lineGap;
        const breakGap = 22;
        const uid = Math.random().toString(36).slice(2, 8);

        const animCSS = animate
            ? `@keyframes brush-paint-${uid}{from{stroke-dashoffset:var(--dl);opacity:0.3}to{stroke-dashoffset:0;opacity:1}}`
            : '';

        const wavyPath = (x1, x2, yc, seed) => {
            const wobble = (((seed * 7919) % 5) - 2) * 0.5;
            return `M ${x1} ${yc} Q ${x1 + (x2 - x1) * 0.5} ${yc + wobble} ${x2} ${yc}`;
        };

        let svgPaths = '';
        const reversed = [...this.lines].reverse();
        reversed.forEach((bit, vi) => {
            const yc = vi * (sw + lineGap) + sw / 2;
            const b = Number(bit);
            const isYang = b === 1 || b === 7 || b === 9;
            const isMoving = b === 6 || b === 9;
            const delay = animate ? vi * animationBaseDelay : 0;
            const seed = vi * 13 + (isYang ? 7 : 3);

            const stroke = (pathLen, d, extraDelay = 0) => {
                const del = (delay + extraDelay).toFixed(3);
                const styleAttr = animate
                    ? `style="stroke-dasharray:${pathLen};--dl:${pathLen};stroke-dashoffset:${pathLen};animation:brush-paint-${uid} ${animationDuration}s cubic-bezier(0.25,0.1,0.3,1) ${del}s forwards;"`
                    : '';
                return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" opacity="${animate ? 0 : 0.9}" ${styleAttr}/>`;
            };

            if (isYang) {
                svgPaths += stroke(w, wavyPath(0, w, yc, seed));
            } else {
                const segW = (w - breakGap) / 2;
                svgPaths += stroke(segW, wavyPath(0, segW, yc, seed));
                svgPaths += stroke(segW, wavyPath(w - segW, w, yc, seed + 31), animationDuration * 0.45);
            }

            if (isMoving) {
                const dotDel = animate ? (delay + animationDuration * 0.9).toFixed(2) : 0;
                svgPaths += `<circle cx="${w / 2}" cy="${yc}" r="${sw * 0.38}" fill="hsl(38,80%,58%)" opacity="${animate ? 0 : 1}" ${animate ? `style="animation:brush-paint-${uid} 0.3s ease ${dotDel}s forwards;"` : ''}/>`;
            }
        });

        container.innerHTML = `
      <svg width="${w}" height="${totalH}" viewBox="0 0 ${w} ${totalH}" style="display:block;overflow:visible;">
        ${animCSS ? `<defs><style>${animCSS}</style></defs>` : ''}
        ${svgPaths}
      </svg>`;
    }
}

// ─── EnsoLoader ───────────────────────────────────────────────
export class EnsoLoader {
    constructor(container) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this._timer = null;
    }

    show(duration = 2500) {
        if (!this.container) return;
        this.container.innerHTML = `
      <div class="enso-container">
        <svg class="enso-svg" viewBox="0 0 100 100">
          <circle class="enso-circle" cx="50" cy="50" r="45"/>
        </svg>
      </div>`;
        this._timer = setTimeout(() => { if (this.container) this.container.innerHTML = ''; }, duration);
    }

    hide() {
        if (this._timer) clearTimeout(this._timer);
        if (this.container) this.container.innerHTML = '';
    }
}

// ─── drawHanzi ────────────────────────────────────────────────
export function drawHanzi(container, char, size = 120) {
    if (!container) return;

    if (!window.HanziWriter) {
        container.innerHTML = `<div style="font-size:${Math.floor(size * 0.8)}px;font-family:var(--font-serif),serif;color:var(--text);line-height:1;text-align:center;width:${size}px;">${char}</div>`;
        return;
    }

    const writerEl = document.createElement('div');
    writerEl.style.cssText = `width:${size}px;height:${size}px;display:inline-block;`;
    container.innerHTML = '';
    container.appendChild(writerEl);

    try {
        const strokeColor = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#1a1a2e';
        const writer = HanziWriter.create(writerEl, char, {
            width: size,
            height: size,
            padding: 8,
            strokeColor,
            strokeAnimationSpeed: prefersReducedMotion() ? 0 : 1.2,
            delayBetweenStrokes: prefersReducedMotion() ? 0 : 80,
            drawingWidth: 4,
            showOutline: true,
            outlineColor: 'rgba(0,0,0,0.07)',
        });
        writer.animateCharacter();
    } catch {
        container.innerHTML = `<div style="font-size:${Math.floor(size * 0.8)}px;font-family:var(--font-serif),serif;color:var(--text);line-height:1;text-align:center;">${char}</div>`;
    }
}

// ─── InteractiveBook ─────────────────────────────────────────
export class InteractiveBook {
    constructor(container) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.pages = [];
        this._currentPage = 0;
        this._destroyed = false;
    }

    addPage(html, alignment = '--right') {
        this.pages.push({ html, alignment });
        return this;
    }

    render() {
        if (!this.container || this._destroyed) return;
        const isMobile = window.innerWidth <= 850;

        if (isMobile) {
            this.container.innerHTML = `
        <div class="book-container" style="display:flex;flex-direction:column;gap:16px;scroll-snap-type:y mandatory;overflow-y:auto;height:75vh;padding-bottom:20px;">
          ${this.pages.map((p, i) => `
            <div class="book-page ${p.alignment}" style="scroll-snap-align:start;flex-shrink:0;height:100%;">
              <div class="page-content">${p.html}</div>
              <div class="page-footer">${i + 1} / ${this.pages.length}</div>
            </div>`).join('')}
        </div>`;
        } else {
            this.container.innerHTML = `
        <div class="book-reader">
          <div class="book-container" id="bookPagesContainer" style="position:relative;min-height:500px;">
            ${this.pages.map((p, i) => `
              <div class="book-page ${p.alignment}" data-page="${i}" style="${i === 0 ? '' : 'display:none;'}">
                <div class="page-content">${p.html}</div>
                <div class="page-footer">${i + 1} / ${this.pages.length}</div>
              </div>`).join('')}
          </div>
          ${this.pages.length > 1 ? `
            <div class="book-nav">
              <button class="btn btn--ghost" id="bookPrev">← Anterior</button>
              <span class="book-nav-indicator" id="bookPageIndicator">1 / ${this.pages.length}</span>
              <button class="btn btn--ghost" id="bookNext">Siguiente →</button>
            </div>` : ''}
        </div>`;
            this._bindNavigation();
        }
    }

    _bindNavigation() {
        const showPage = (idx) => {
            this.container.querySelectorAll('[data-page]').forEach(p => p.style.display = 'none');
            const cur = this.container.querySelector(`[data-page="${idx}"]`);
            if (cur) cur.style.display = '';
            const ind = this.container.querySelector('#bookPageIndicator');
            if (ind) ind.textContent = `${idx + 1} / ${this.pages.length}`;
            this._currentPage = idx;
            const prev = this.container.querySelector('#bookPrev');
            const next = this.container.querySelector('#bookNext');
            if (prev) prev.disabled = idx === 0;
            if (next) next.disabled = idx === this.pages.length - 1;
        };
        this.container.querySelector('#bookPrev')?.addEventListener('click', () => {
            if (this._currentPage > 0) showPage(this._currentPage - 1);
        });
        this.container.querySelector('#bookNext')?.addEventListener('click', () => {
            if (this._currentPage < this.pages.length - 1) showPage(this._currentPage + 1);
        });
        const prev = this.container.querySelector('#bookPrev');
        if (prev) prev.disabled = true;
    }

    destroy() {
        this._destroyed = true;
        if (this.container) this.container.innerHTML = '';
    }
}

// ─── DynamicAvatar ────────────────────────────────────────────
export class DynamicAvatar {
    constructor(src, container) {
        this.src = src;
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this._destroyed = false;
        this._handleMouseMove = null;
        this._handleMouseLeave = null;
    }

    render() {
        if (!this.container || this._destroyed) return;
        this.container.innerHTML = `
      <div class="sage-avatar" style="transform-style:preserve-3d;transition:transform 0.1s ease-out;">
        <img src="${this.src}" alt="El Sabio" decoding="async" loading="eager">
      </div>`;

        const avatar = this.container.querySelector('.sage-avatar');
        if (!avatar || prefersReducedMotion()) return;

        // RAF throttle: only apply one style mutation per animation frame
        let _rafPending = false;
        let _pendingDx = 0, _pendingDy = 0;

        this._handleMouseMove = (e) => {
            if (this._destroyed) return;
            const rect = avatar.getBoundingClientRect();
            _pendingDx = (e.clientX - rect.left - rect.width / 2) / rect.width;
            _pendingDy = (e.clientY - rect.top - rect.height / 2) / rect.height;
            if (_rafPending) return;
            _rafPending = true;
            requestAnimationFrame(() => {
                if (!this._destroyed)
                    avatar.style.transform = `perspective(600px) rotateY(${_pendingDx * 18}deg) rotateX(${-_pendingDy * 18}deg)`;
                _rafPending = false;
            });
        };
        this._handleMouseLeave = () => {
            if (!this._destroyed) avatar.style.transform = '';
        };

        document.addEventListener('mousemove', this._handleMouseMove, { passive: true });
        document.addEventListener('mouseleave', this._handleMouseLeave);
    }

    destroy() {
        this._destroyed = true;
        if (this._handleMouseMove) document.removeEventListener('mousemove', this._handleMouseMove);
        if (this._handleMouseLeave) document.removeEventListener('mouseleave', this._handleMouseLeave);
    }
}
