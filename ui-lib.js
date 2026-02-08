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
