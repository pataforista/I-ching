export class Typewriter {
    constructor(element, options = {}) {
        this.element = typeof element === 'string' ? document.querySelector(element) : element;
        this.options = {
            typingSpeed: 40,
            initialDelay: 0,
            cursor: true,
            cursorChar: '█',
            onComplete: null,
            ...options
        };

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
        this.contentEl.innerHTML = '';
        if (this.options.initialDelay) await this.delay(this.options.initialDelay);

        for (let i = 0; i < text.length; i++) {
            const char = document.createElement('span');
            char.textContent = text.charAt(i);
            char.style.opacity = '0';
            char.style.transition = 'opacity 0.3s ease-out';
            this.contentEl.appendChild(char);

            // Force reflow
            void char.offsetWidth;
            char.style.opacity = '1';

            // Variable speed for natural feel
            const speedVar = Math.random() * 30;
            await this.delay(this.options.typingSpeed + speedVar);
        }

        if (this.options.onComplete) this.options.onComplete();
    }

    delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}

export class BubbleMenu {
    constructor(items = [], options = {}) {
        this.items = items;
        this.options = {
            position: 'bottom-right',
            mainIcon: '☸', // Dharma Wheel instead of plain menu
            ...options
        };
        this.isOpen = false;
        this.render();
    }

    render() {
        this.root = document.createElement('div');
        this.root.className = 'bubble-menu-root';
        this.root.style.cssText = 'position:fixed; bottom:40px; right:40px; z-index:1000; display:flex; flex-direction:column-reverse; align-items:center; gap:16px;';

        // Toggle Button
        this.toggleBtn = document.createElement('div');
        this.toggleBtn.className = 'bubble-toggle';
        this.toggleBtn.innerHTML = this.options.mainIcon;
        this.toggleBtn.style.cssText = 'width:64px; height:64px; border-radius:50%; background:var(--text); color:var(--bg); box-shadow:0 15px 35px rgba(0,0,0,0.2); display:grid; place-items:center; cursor:pointer; font-size:24px; transition:all 0.4s cubic-bezier(0.16, 1, 0.3, 1);';
        this.toggleBtn.onclick = () => this.toggle();
        this.root.appendChild(this.toggleBtn);

        // Items Container
        this.itemsContainer = document.createElement('div');
        this.itemsContainer.style.cssText = 'display:flex; flex-direction:column; gap:12px; align-items:center;';
        this.root.appendChild(this.itemsContainer);

        // Render Items
        this.items.forEach((item, idx) => {
            const btn = document.createElement('button');
            btn.className = 'bubble-btn';
            btn.innerHTML = `<span>${item.label}</span>`;
            btn.style.cssText = 'padding:12px 24px; background:var(--panel-bg); color:var(--text); border:1px solid var(--panel-border); border-radius:100px; backdrop-filter:blur(10px); cursor:pointer; font-family:var(--font-sans); font-weight:600; opacity:0; transform:translateY(20px); transition:all 0.4s cubic-bezier(0.16, 1, 0.3, 1); visibility:hidden; box-shadow:var(--panel-shadow);';
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
                angle: angle,
                radius: radius,
                speed: 0.001 + Math.random() * 0.002,
                drift: Math.random() * 0.5
            });
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;

        this.ctx.filter = 'blur(3px)'; // Apply cloud-like effect here instead of per arc
        this.particles.forEach(p => {
            p.angle += p.speed;

            let tx = cx + Math.cos(p.angle) * p.radius;
            let ty = cy + Math.sin(p.angle) * p.radius;

            const dx = tx - this.mouseX;
            const dy = ty - this.mouseY;
            const dist = dx * dx + dy * dy; // Avoid sqrt for distance check

            if (dist < 40000) { // 200^2
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
            maxTilt: 10,
            perspective: 1200,
            scale: 1.02,
            speed: 600,
            glare: true,
            glareOpacity: 0.2,
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
        this.glareInner.style.cssText = 'position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); width:200%; height:200%; background:radial-gradient(circle at center, hsla(0, 0%, 100%, 0.8) 0%, transparent 60%);';
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

export class EnsoLoader {
    constructor(container) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
    }

    show() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="enso-container">
                <svg class="enso-svg" viewBox="0 0 100 100">
                    <circle class="enso-circle" cx="50" cy="50" r="45" />
                </svg>
                <div class="muted serif" style="margin-top:10px; opacity:0.6;">Consultando al Oráculo...</div>
            </div>
        `;
    }
}

export class DynamicHexagram {
    constructor(lines, options = {}) {
        this.lines = lines; // [L1, L2, L3, L4, L5, L6] (bottom to top)
        this.options = {
            width: 200,
            height: 140,
            strokeWidth: 8,
            gap: 12,
            movingLineColor: 'var(--accent)',
            ...options
        };
    }

    render(targetEl) {
        const el = typeof targetEl === 'string' ? document.querySelector(targetEl) : targetEl;
        if (!el) return;

        const { width, height, strokeWidth, gap } = this.options;
        const lineH = (height - (gap * 5)) / 6;

        let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="filter: var(--sumi-filter);" role="img" aria-label="Hexagrama del I Ching con líneas ${this.lines.join(', ')}">`;

        this.lines.forEach((val, i) => {
            const y = height - (i + 1) * (lineH + gap) + gap;
            const isYang = val === 7 || val === 9;
            const isMoving = val === 6 || val === 9;
            const color = isMoving ? this.options.movingLineColor : 'var(--text)';

            if (isYang) {
                svg += `<rect x="10" y="${y}" width="${width - 20}" height="${lineH}" fill="${color}" rx="4" />`;
            } else {
                const partW = (width - 40) / 2;
                svg += `<rect x="10" y="${y}" width="${partW}" height="${lineH}" fill="${color}" rx="4" />`;
                svg += `<rect x="${width - 10 - partW}" y="${y}" width="${partW}" height="${lineH}" fill="${color}" rx="4" />`;
            }

            if (isMoving) {
                // Add a small mark or glow for moving lines
                svg += `<circle cx="${width / 2}" cy="${y + lineH / 2}" r="3" fill="var(--bg)" opacity="0.6" />`;
            }
        });

        svg += `</svg>`;
        el.innerHTML = svg;
    }
}

export function drawHanzi(target, char, size = 100) {
    if (!window.HanziWriter) return;
    const writer = HanziWriter.create(target, char, {
        width: size,
        height: size,
        padding: 5,
        strokeColor: 'var(--text)',
        outlineColor: 'var(--panel-border)',
        drawingColor: 'var(--accent)',
        showOutline: true,
        strokeAnimationSpeed: 1,
        delayBetweenStrokes: 200
    });
    writer.animateCharacter();
    return writer;
}

export class InteractiveBook {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.options = {
            width: 550, // base page width
            height: 733, // base page height
            size: "stretch",
            minWidth: 315,
            maxWidth: 1000,
            minHeight: 420,
            maxHeight: 1350,
            maxShadowOpacity: 0.5,
            showCover: false,
            mobileScrollSupport: true,
            ...options
        };
        this.pages = [];
        this.pageFlip = null;
    }

    addPage(contentHTML, pageClass = "") {
        this.pages.push({ html: contentHTML, className: pageClass });
    }

    render() {
        if (!this.container) return;

        // Clear and build structure
        this.container.innerHTML = `<div id="bookFlipRoot" class="book-container"></div>`;
        const root = document.getElementById("bookFlipRoot");

        this.pages.forEach((p, idx) => {
            const pageEl = document.createElement("div");
            pageEl.className = `book-page ${p.className}`;
            pageEl.innerHTML = `
                <div class="page-content">${p.html}</div>
                <div class="page-footer">${idx + 1} de ${this.pages.length}</div>
            `;
            root.appendChild(pageEl);
        });

        // Init Library
        if (window.St && window.St.PageFlip) {
            this.pageFlip = new St.PageFlip(root, this.options);
            this.pageFlip.loadFromHTML(document.querySelectorAll(".book-page"));

            this._resizeHandler = () => {
                if (window.innerWidth <= 600) {
                    if (this.pageFlip) this.pageFlip.destroy();
                }
            };
            window.addEventListener("resize", this._resizeHandler);
        }
    }

    destroy() {
        if (this.pageFlip) {
            this.pageFlip.destroy();
            this.pageFlip = null;
        }
        if (this._resizeHandler) {
            window.removeEventListener("resize", this._resizeHandler);
        }
        if (this.container) this.container.innerHTML = "";
    }

    turnToPage(idx) {
        if (this.pageFlip) this.pageFlip.turnToPage(idx);
    }
}

export class DynamicAvatar {
    constructor(imgSrc, containerSelector) {
        this.imgSrc = imgSrc;
        this.container = typeof containerSelector === 'string' ? document.querySelector(containerSelector) : containerSelector;
        this.tiltX = 0;
        this.tiltY = 0;
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="sage-avatar dynamic-avatar">
                <img src="${this.imgSrc}" alt="El Sabio" class="sage-img">
            </div>
        `;

        this.el = this.container.querySelector('.sage-avatar');
        this.initParallax();
    }

    initParallax() {
        if (window.innerWidth < 850) return; // Skip on mobile

        this._mouseHandler = (e) => {
            if (!this.el || !document.contains(this.el)) return; // Check if still in DOM

            const { clientX, clientY } = e;
            const { innerWidth, innerHeight } = window;

            const x = (clientX / innerWidth - 0.5) * 2;
            const y = (clientY / innerHeight - 0.5) * 2;

            this.tiltX = x * 15;
            this.tiltY = y * -15;

            this.el.style.transform = `perspective(1000px) rotateY(${this.tiltX}deg) rotateX(${this.tiltY}deg)`;
        };

        this._gyroHandler = (e) => {
            if (!this.el || !document.contains(this.el)) return;
            if (!e.gamma || !e.beta) return;

            const x = e.gamma / 45;
            const y = e.beta / 45;

            this.tiltX = x * 10;
            this.tiltY = y * -10;

            this.el.style.transform = `perspective(1000px) rotateY(${this.tiltX}deg) rotateX(${this.tiltY}deg)`;
        };

        document.addEventListener('mousemove', this._mouseHandler);
        window.addEventListener('deviceorientation', this._gyroHandler);
    }

    destroy() {
        if (this._mouseHandler) document.removeEventListener('mousemove', this._mouseHandler);
        if (this._gyroHandler) window.removeEventListener('deviceorientation', this._gyroHandler);
        if (this.container) this.container.innerHTML = "";
        this.el = null;
    }

    setBubbleText(text) {
        const bubble = document.querySelector('.sage-bubble');
        if (bubble) bubble.textContent = text;
    }
}
