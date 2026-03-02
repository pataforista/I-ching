// ui-lib.js — Premium UI Component Library for I Ching

export class Typewriter {
    constructor(element, options = {}) {
        this.element = typeof element === 'string' ? document.querySelector(element) : element;
        this.options = {
            typingSpeed: 15,
            initialDelay: 0,
            cursor: true,
            cursorChar: '█',
            onComplete: null,
            ...options
        };
        this._cancelled = false;
        this.init();
    }

    init() {
        if (!this.element) return;
        this.element.innerHTML = '';
        this.element.style.position = 'relative';

        if (this.options.cursor) {
            this.cursorEl = document.createElement('span');
            this.cursorEl.className = 'cursor';
            this.cursorEl.textContent = this.options.cursorChar;
            this.cursorEl.style.color = 'var(--accent)';
            this.cursorEl.style.opacity = '0.8';
        }

        this.contentEl = document.createElement('span');
        this.element.appendChild(this.contentEl);
        if (this.cursorEl) this.element.appendChild(this.cursorEl);
    }

    async type(text) {
        if (!this.element) return;
        this._cancelled = false;
        this.contentEl.innerHTML = '';
        if (this.options.initialDelay) await this.delay(this.options.initialDelay);

        for (let i = 0; i < text.length; i++) {
            if (this._cancelled) break;
            const char = document.createElement('span');
            char.textContent = text.charAt(i);
            char.style.opacity = '0';
            char.style.transition = 'opacity 0.3s ease-out';
            this.contentEl.appendChild(char);
            void char.offsetWidth;
            char.style.opacity = '1';
            const speedVar = Math.random() * 20;
            await this.delay(this.options.typingSpeed + speedVar);
        }

        if (!this._cancelled && this.options.onComplete) this.options.onComplete();
    }

    cancel() { this._cancelled = true; }

    delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}

export class BubbleMenu {
    constructor(itemsOrConfig = [], options = {}) {
        // Support both legacy (items, options) and object config { container, items, ... }
        if (!Array.isArray(itemsOrConfig) && typeof itemsOrConfig === 'object') {
            this.items = itemsOrConfig.items || [];
            this.options = {
                position: 'bottom-right',
                mainIcon: '☸',
                ...options,
                ...itemsOrConfig
            };
        } else {
            this.items = itemsOrConfig;
            this.options = {
                position: 'bottom-right',
                mainIcon: '☸',
                ...options
            };
        }
        this.isOpen = false;
        this.render();
    }

    render() {
        this.root = document.createElement('div');
        this.root.className = 'bubble-menu-root';
        this.root.style.cssText = 'position:fixed; bottom:clamp(16px, 4vw, 40px); right:clamp(16px, 4vw, 40px); z-index:1000; display:flex; flex-direction:column-reverse; align-items:center; gap:16px;';

        this.toggleBtn = document.createElement('div');
        this.toggleBtn.className = 'bubble-toggle';
        this.toggleBtn.innerHTML = this.options.mainIcon;
        this.toggleBtn.style.cssText = 'width:64px; height:64px; border-radius:50%; background:var(--text); color:var(--bg); box-shadow:0 15px 35px rgba(0,0,0,0.2); display:grid; place-items:center; cursor:pointer; font-size:24px; transition:all 0.4s cubic-bezier(0.16, 1, 0.3, 1); user-select:none;';
        this.toggleBtn.onclick = () => this.toggle();
        this.root.appendChild(this.toggleBtn);

        this.itemsContainer = document.createElement('div');
        this.itemsContainer.style.cssText = 'display:flex; flex-direction:column; gap:12px; align-items:center;';
        this.root.appendChild(this.itemsContainer);

        this.items.forEach((item, idx) => {
            const btn = document.createElement('button');
            btn.className = 'bubble-btn';
            btn.innerHTML = `<span style="margin-right:8px;">${item.icon || ''}</span><span>${item.label}</span>`;
            btn.style.cssText = 'padding:12px 24px; background:var(--panel-bg); color:var(--text); border:1px solid var(--panel-border); border-radius:100px; backdrop-filter:blur(10px); cursor:pointer; font-family:var(--font-sans); font-weight:600; font-size:0.9rem; opacity:0; transform:translateY(20px); transition:all 0.4s cubic-bezier(0.16, 1, 0.3, 1); visibility:hidden; box-shadow:var(--panel-shadow); white-space:nowrap;';
            btn.style.transitionDelay = `${idx * 0.05}s`;

            btn.onclick = () => {
                this.toggle(false);
                if (item.onClick) item.onClick();
            };

            this.itemsContainer.appendChild(btn);
        });

        document.body.appendChild(this.root);
    }

    toggle(forceState) {
        this.isOpen = forceState !== undefined ? forceState : !this.isOpen;
        const btns = this.itemsContainer.querySelectorAll('.bubble-btn');

        if (this.isOpen) {
            this.toggleBtn.style.transform = 'rotate(180deg) scale(0.9)';
            this.toggleBtn.style.background = 'var(--accent)';
            btns.forEach(b => {
                b.style.opacity = '1';
                b.style.transform = 'translateY(0)';
                b.style.visibility = 'visible';
            });
        } else {
            this.toggleBtn.style.transform = 'rotate(0) scale(1)';
            this.toggleBtn.style.background = 'var(--text)';
            btns.forEach(b => {
                b.style.opacity = '0';
                b.style.transform = 'translateY(20px)';
                setTimeout(() => { if (!this.isOpen) b.style.visibility = 'hidden'; }, 400);
            });
        }
    }

    destroy() {
        if (this.root && this.root.parentNode) {
            this.root.parentNode.removeChild(this.root);
        }
    }
}

export class InkGalaxy {
    constructor(options = {}) {
        this.options = {
            count: 200,
            colors: ["hsla(215, 51%, 31%, 0.1)", "hsla(6, 68%, 56%, 0.08)", "hsla(40, 48%, 56%, 0.1)"],
            ...options
        };
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.mouseX = 0;
        this.mouseY = 0;
        this._running = true;
        this.init();
    }

    init() {
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; z-index:-1; pointer-events:none; opacity:0.6;';
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        this.resize();
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('mousemove', (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        });

        this.createParticles();
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createParticles() {
        this.particles = [];
        for (let i = 0; i < this.options.count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * (Math.max(this.canvas.width, this.canvas.height) * 0.8);
            this.particles.push({
                x: this.canvas.width / 2 + Math.cos(angle) * radius,
                y: this.canvas.height / 2 + Math.sin(angle) * radius,
                size: Math.random() * 4 + 1,
                color: this.options.colors[Math.floor(Math.random() * this.options.colors.length)],
                angle,
                radius,
                speed: 0.001 + Math.random() * 0.002,
                drift: Math.random() * 0.5
            });
        }
    }

    animate() {
        if (!this._running) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;

        this.ctx.filter = 'blur(3px)';
        this.particles.forEach(p => {
            p.angle += p.speed;
            let tx = cx + Math.cos(p.angle) * p.radius;
            let ty = cy + Math.sin(p.angle) * p.radius;

            const dx = tx - this.mouseX;
            const dy = ty - this.mouseY;
            const dist = dx * dx + dy * dy;

            if (dist < 40000) {
                const d = Math.sqrt(dist);
                const force = (200 - d) / 200;
                tx += (dx / d) * force * 30;
                ty += (dy / d) * force * 30;
            }

            this.ctx.beginPath();
            this.ctx.arc(tx, ty, p.size, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color;
            this.ctx.fill();
        });

        requestAnimationFrame(() => this.animate());
    }
}

export class TiltCard {
    constructor(element, options = {}) {
        this.element = element;
        this.options = {
            maxTilt: 8,
            perspective: 1200,
            scale: 1.01,
            speed: 600,
            glare: true,
            glareOpacity: 0.15,
            ...options
        };
        this.init();
    }

    init() {
        this.element.style.transformStyle = "preserve-3d";
        this.element.style.transition = `transform ${this.options.speed}ms cubic-bezier(0.03, 0.98, 0.52, 0.99)`;

        if (this.options.glare) {
            this.prepareGlare();
        }

        this.element.addEventListener("mousemove", (e) => this.onMove(e));
        this.element.addEventListener("mouseleave", () => this.onLeave());
    }

    prepareGlare() {
        this.glareEl = document.createElement("div");
        this.glareEl.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:10; border-radius:inherit; overflow:hidden; opacity:0; transition:opacity 400ms;';
        this.glareInner = document.createElement("div");
        this.glareInner.style.cssText = 'position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); width:200%; height:200%; background:radial-gradient(circle at center, hsla(0, 0%, 100%, 0.7) 0%, transparent 60%);';
        this.glareEl.appendChild(this.glareInner);
        this.element.appendChild(this.glareEl);
    }

    onMove(e) {
        const rect = this.element.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const px = x / rect.width;
        const py = y / rect.height;

        const tiltX = (this.options.maxTilt / 2 - py * this.options.maxTilt).toFixed(2);
        const tiltY = (px * this.options.maxTilt - this.options.maxTilt / 2).toFixed(2);

        this.element.style.transform = `perspective(${this.options.perspective}px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(${this.options.scale}, ${this.options.scale}, ${this.options.scale})`;

        if (this.glareEl) {
            this.glareEl.style.opacity = this.options.glareOpacity;
            this.glareInner.style.transform = `translate(${(px - 0.5) * -50}%, ${(py - 0.5) * -50}%)`;
        }
    }

    onLeave() {
        this.element.style.transform = `perspective(${this.options.perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
        if (this.glareEl) this.glareEl.style.opacity = '0';
    }
}

export class ShaoYongCircle {
    constructor(container, hexagrams, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.hexagrams = hexagrams;
        this.options = {
            radius: 200,
            onHexClick: null,
            ...options
        };
        this.init();
    }

    init() {
        if (!this.container) return;
        this.render();
    }

    render() {
        const { radius } = this.options;
        const centerX = radius + 50;
        const centerY = radius + 50;
        const size = (radius + 50) * 2;

        let html = `<svg viewBox="0 0 ${size} ${size}" class="shaoYongCircle">`;
        html += `<circle cx="${centerX}" cy="${centerY}" r="${radius + 20}" fill="none" stroke="var(--accent-soft)" stroke-width="1" opacity="0.3"/>`;

        this.hexagrams.forEach((hex, i) => {
            const angle = (i / 64) * Math.PI * 2 - Math.PI / 2;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            const hexSize = 12;
            const lineSpacing = 2;

            html += `<g class="hex-node" transform="translate(${x - hexSize / 2}, ${y - (hexSize + lineSpacing * 5) / 2})" data-id="${hex.id}" style="cursor:pointer;">`;

            const binary = hex.binary || "000000";
            for (let l = 0; l < 6; l++) {
                const isYang = binary[5 - l] === '1';
                const ly = l * (2 + lineSpacing);
                if (isYang) {
                    html += `<line x1="0" y1="${ly}" x2="${hexSize}" y2="${ly}" stroke="var(--text)" stroke-width="1.5" />`;
                } else {
                    html += `<line x1="0" y1="${ly}" x2="${hexSize / 2.5}" y2="${ly}" stroke="var(--text)" stroke-width="1.5" />`;
                    html += `<line x1="${hexSize - hexSize / 2.5}" y1="${ly}" x2="${hexSize}" y2="${ly}" stroke="var(--text)" stroke-width="1.5" />`;
                }
            }
            html += `<rect x="-2" y="-2" width="${hexSize + 4}" height="${(2 + lineSpacing) * 6}" fill="transparent" />`;
            html += `</g>`;
        });

        html += `</svg>`;
        this.container.innerHTML = html;

        this.container.querySelectorAll('.hex-node').forEach(node => {
            node.addEventListener('click', () => {
                const id = node.getAttribute('data-id');
                if (this.options.onHexClick) this.options.onHexClick(id);
            });
            node.addEventListener('mouseenter', () => {
                node.style.filter = "drop-shadow(0 0 5px var(--gold))";
            });
            node.addEventListener('mouseleave', () => {
                node.style.filter = "none";
            });
        });
    }
}

// --- Premium Components ---

export class DynamicHexagram {
    constructor(lines, options = {}) {
        // lines: array of 6 values (0/1 or coin values 6/7/8/9), ordered bottom-to-top
        this.lines = Array.isArray(lines) ? lines : [0, 0, 0, 0, 0, 0];
        this.options = {
            width: 130,
            strokeWidth: 10,
            lineGap: 16,
            animate: true,
            animationDuration: 0.55,   // seconds per stroke
            animationBaseDelay: 0.08,  // stagger between lines
            color: 'currentColor',
            ...options
        };
    }

    render(container) {
        if (!container) return;

        const { width: w, strokeWidth: sw, lineGap, animate, animationDuration, animationBaseDelay, color } = this.options;
        const lineH = sw;
        const totalLines = 6;
        const totalH = totalLines * lineH + (totalLines - 1) * lineGap;
        const breakGap = 22; // gap between yin segments
        const uid = Math.random().toString(36).slice(2, 8); // unique ID for keyframes

        // Generate inline CSS keyframes once per render
        const animCSS = animate ? `
            @keyframes brush-paint-${uid} {
                from { stroke-dashoffset: var(--dash-len); opacity: 0.4; }
                to   { stroke-dashoffset: 0;               opacity: 1;   }
            }` : '';

        // Helper: produce a slightly wavy path between two x positions at given y center
        // Uses a quadratic bezier with random-ish control point for organic feel
        const wavyPath = (x1, x2, yc, seed) => {
            const segLen = x2 - x1;
            // Control point: horizontally centered, slight random vertical wobble
            const wobble = (((seed * 7919) % 5) - 2) * 0.5; // deterministic, -1..+1 px
            const cx = x1 + segLen * 0.5;
            const cy = yc + wobble;
            return `M ${x1} ${yc} Q ${cx} ${cy} ${x2} ${yc}`;
        };

        let svgPaths = '';

        // Render lines top-to-bottom visually (bit array is bottom-to-top)
        const reversed = [...this.lines].reverse();
        reversed.forEach((bit, visualIdx) => {
            const yCenter = visualIdx * (lineH + lineGap) + lineH / 2;
            const b = Number(bit);
            // Normalize coin values → 0 (yin) / 1 (yang)
            const isYang = b === 1 || b === 7 || b === 9;
            const isMoving = b === 6 || b === 9;

            // Delay: top line paints first when text flows top→bottom
            const delay = animate ? (visualIdx * animationBaseDelay) : 0;
            const seed = visualIdx * 13 + (isYang ? 7 : 3);

            const style = (pathLen) => animate
                ? `style="stroke-dasharray:${pathLen};--dash-len:${pathLen};stroke-dashoffset:${pathLen};animation:brush-paint-${uid} ${animationDuration}s cubic-bezier(0.25, 0.1, 0.3, 1.0) ${delay}s forwards;"`
                : '';

            if (isYang) {
                // Yang: one full brush stroke, slightly tapered look
                const pathLen = w;
                const d = wavyPath(0, w, yCenter, seed);
                svgPaths += `
                    <path
                        d="${d}"
                        fill="none"
                        stroke="${color}"
                        stroke-width="${sw}"
                        stroke-linecap="round"
                        opacity="${animate ? 0 : 0.9}"
                        ${style(pathLen)}
                    />`;
            } else {
                // Yin: two broken strokes with gap in middle
                const segW = (w - breakGap) / 2;
                const pathLen1 = segW;
                const pathLen2 = segW;
                const seed2 = seed + 31;

                const d1 = wavyPath(0, segW, yCenter, seed);
                const d2 = wavyPath(w - segW, w, yCenter, seed2);

                // Left segment
                svgPaths += `
                    <path
                        d="${d1}"
                        fill="none"
                        stroke="${color}"
                        stroke-width="${sw}"
                        stroke-linecap="round"
                        opacity="${animate ? 0 : 0.9}"
                        ${style(pathLen1)}
                    />`;
                // Right segment — slight extra delay so it paints after the left one
                const delay2 = animate ? delay + animationDuration * 0.45 : 0;
                const style2 = animate
                    ? `style="stroke-dasharray:${pathLen2};--dash-len:${pathLen2};stroke-dashoffset:${pathLen2};animation:brush-paint-${uid} ${animationDuration * 0.7}s cubic-bezier(0.25, 0.1, 0.3, 1.0) ${delay2}s forwards;"`
                    : '';
                svgPaths += `
                    <path
                        d="${d2}"
                        fill="none"
                        stroke="${color}"
                        stroke-width="${sw}"
                        stroke-linecap="round"
                        opacity="${animate ? 0 : 0.9}"
                        ${style2}
                    />`;
            }

            // Moving line marker: golden dot in the center
            if (isMoving) {
                const dotDelay = animate ? (delay + animationDuration * 0.9).toFixed(2) : 0;
                svgPaths += `
                    <circle
                        cx="${w / 2}" cy="${yCenter}" r="${sw * 0.38}"
                        fill="hsl(38, 80%, 58%)"
                        opacity="${animate ? 0 : 1}"
                        ${animate ? `style="animation: brush-paint-${uid} 0.3s ease ${dotDelay}s forwards;"` : ''}
                    />`;
            }
        });

        const svg = `
            <svg
                width="${w}"
                height="${totalH}"
                viewBox="0 0 ${w} ${totalH}"
                style="display:block; overflow:visible;"
            >
                ${animCSS ? `<defs><style>${animCSS}</style></defs>` : ''}
                ${svgPaths}
            </svg>`;

        container.innerHTML = svg;
    }
}


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
            </div>
        `;
        this._timer = setTimeout(() => {
            if (this.container) this.container.innerHTML = '';
        }, duration);
    }

    hide() {
        if (this._timer) clearTimeout(this._timer);
        if (this.container) this.container.innerHTML = '';
    }
}

export function drawHanzi(container, char, size = 120) {
    if (!container) return;

    if (!window.HanziWriter) {
        // Fallback: render static character
        container.innerHTML = `<div style="font-size:${Math.floor(size * 0.8)}px; font-family:var(--font-serif), 'Noto Serif SC', serif; color:var(--text); line-height:1; text-align:center; width:${size}px;">${char}</div>`;
        return;
    }

    const writerEl = document.createElement('div');
    writerEl.style.cssText = `width:${size}px; height:${size}px; display:inline-block;`;
    container.innerHTML = '';
    container.appendChild(writerEl);

    try {
        const strokeColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--text').trim() || '#1a1a2e';

        const writer = HanziWriter.create(writerEl, char, {
            width: size,
            height: size,
            padding: 8,
            strokeColor,
            strokeAnimationSpeed: 1.2,
            delayBetweenStrokes: 80,
            drawingWidth: 4,
            showOutline: true,
            outlineColor: 'rgba(0,0,0,0.08)',
        });
        writer.animateCharacter();
    } catch (e) {
        container.innerHTML = `<div style="font-size:${Math.floor(size * 0.8)}px; font-family:var(--font-serif), serif; color:var(--text); line-height:1; text-align:center; width:${size}px;">${char}</div>`;
    }
}

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
            // Mobile: vertical stack with scroll snap for direct physical manipulation
            this.container.innerHTML = `
                <div class="book-container" style="display:flex; flex-direction:column; gap:16px; scroll-snap-type: y mandatory; overflow-y: auto; height: 75vh; padding-bottom: 20px;">
                    ${this.pages.map((p, i) => `
                        <div class="book-page ${p.alignment}" style="scroll-snap-align: start; flex-shrink: 0; height: 100%;">
                            <div class="page-content">${p.html}</div>
                            <div class="page-footer">${i + 1} / ${this.pages.length}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            // Desktop: paginated with prev/next navigation
            this.container.innerHTML = `
                <div class="book-reader">
                    <div class="book-container" id="bookPagesContainer" style="position:relative; min-height:500px;">
                        ${this.pages.map((p, i) => `
                            <div class="book-page ${p.alignment}" data-page="${i}" style="${i === 0 ? '' : 'display:none;'}">
                                <div class="page-content">${p.html}</div>
                                <div class="page-footer">${i + 1} / ${this.pages.length}</div>
                            </div>
                        `).join('')}
                    </div>
                    ${this.pages.length > 1 ? `
                        <div class="book-nav">
                            <button class="btn btn--ghost" id="bookPrev">← Anterior</button>
                            <span class="book-nav-indicator" id="bookPageIndicator">1 / ${this.pages.length}</span>
                            <button class="btn btn--ghost" id="bookNext">Siguiente →</button>
                        </div>
                    ` : ''}
                </div>
            `;
            this._bindNavigation();
        }
    }

    _bindNavigation() {
        const prevBtn = this.container.querySelector('#bookPrev');
        const nextBtn = this.container.querySelector('#bookNext');
        const indicator = this.container.querySelector('#bookPageIndicator');

        const showPage = (idx) => {
            const allPages = this.container.querySelectorAll('[data-page]');
            allPages.forEach(p => p.style.display = 'none');
            const current = this.container.querySelector(`[data-page="${idx}"]`);
            if (current) {
                current.style.display = '';
                current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            if (indicator) indicator.textContent = `${idx + 1} / ${this.pages.length}`;
            this._currentPage = idx;

            // Disable buttons at edges
            if (prevBtn) prevBtn.disabled = idx === 0;
            if (nextBtn) nextBtn.disabled = idx === this.pages.length - 1;
        };

        prevBtn?.addEventListener('click', () => {
            if (this._currentPage > 0) showPage(this._currentPage - 1);
        });

        nextBtn?.addEventListener('click', () => {
            if (this._currentPage < this.pages.length - 1) showPage(this._currentPage + 1);
        });

        // Initialize button states
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn && this.pages.length <= 1) nextBtn.disabled = true;
    }

    destroy() {
        this._destroyed = true;
        if (this.container) this.container.innerHTML = '';
    }
}

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
            <div class="sage-avatar" style="transform-style:preserve-3d; transition:transform 0.1s ease-out;">
                <img src="${this.src}" alt="El Sabio" decoding="async" loading="eager">
            </div>
        `;

        const avatar = this.container.querySelector('.sage-avatar');
        if (!avatar) return;

        this._handleMouseMove = (e) => {
            if (this._destroyed) return;
            const rect = avatar.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dx = (e.clientX - cx) / rect.width;
            const dy = (e.clientY - cy) / rect.height;
            avatar.style.transform = `perspective(600px) rotateY(${dx * 18}deg) rotateX(${-dy * 18}deg)`;
        };

        this._handleMouseLeave = () => {
            if (this._destroyed) return;
            avatar.style.transform = '';
        };

        document.addEventListener('mousemove', this._handleMouseMove);
        document.addEventListener('mouseleave', this._handleMouseLeave);
    }

    destroy() {
        this._destroyed = true;
        if (this._handleMouseMove) document.removeEventListener('mousemove', this._handleMouseMove);
        if (this._handleMouseLeave) document.removeEventListener('mouseleave', this._handleMouseLeave);
    }
}
