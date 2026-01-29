export class Typewriter {
    constructor(element, options = {}) {
        this.element = typeof element === 'string' ? document.querySelector(element) : element;
        this.options = {
            typingSpeed: 50,
            initialDelay: 0,
            cursor: true,
            cursorChar: '▋',
            onComplete: null,
            ...options
        };

        this.init();
    }

    init() {
        if (!this.element) return;
        this.element.innerHTML = '';

        if (this.options.cursor) {
            this.cursorEl = document.createElement('span');
            this.cursorEl.className = 'cursor';
            this.cursorEl.textContent = this.options.cursorChar;
        }

        this.textNode = document.createTextNode('');
        this.element.appendChild(this.textNode);
        if (this.cursorEl) this.element.appendChild(this.cursorEl);
    }

    async type(text) {
        if (!this.element) return;
        this.textNode.textContent = '';
        if (this.options.initialDelay) await this.delay(this.options.initialDelay);

        for (let i = 0; i < text.length; i++) {
            this.textNode.textContent += text.charAt(i);
            // Variable speed for human feel
            const speedVar = Math.random() * 20;
            await this.delay(this.options.typingSpeed + speedVar);
        }

        if (this.options.onComplete) this.options.onComplete();
    }

    delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}

export class BubbleMenu {
    constructor(items = [], options = {}) {
        this.items = items; // [{ label, icon, onClick }]
        this.options = {
            position: 'bottom-right',
            mainIcon: '☰',
            ...options
        };
        this.isOpen = false;
        this.render();
    }

    render() {
        this.root = document.createElement('div');
        this.root.className = 'bubble-menu-root';

        // Items Container
        this.itemsContainer = document.createElement('div');
        this.itemsContainer.className = 'bubble-items';
        this.root.appendChild(this.itemsContainer);

        // Toggle Button
        this.toggleBtn = document.createElement('div');
        this.toggleBtn.className = 'bubble-toggle';
        this.toggleBtn.textContent = this.options.mainIcon;
        this.toggleBtn.onclick = () => this.toggle();
        this.root.appendChild(this.toggleBtn);

        // Render Items
        this.items.forEach((item, idx) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'bubble-item';
            // Stagger index
            wrapper.style.transitionDelay = `${idx * 0.05}s`;

            const btn = document.createElement('button');
            btn.className = 'bubble-btn';
            btn.textContent = item.label;
            btn.onclick = () => {
                this.toggle(false);
                if (item.onClick) item.onClick();
            };

            wrapper.appendChild(btn);
            this.itemsContainer.appendChild(wrapper);
        });

        document.body.appendChild(this.root);
    }

    toggle(forceState) {
        this.isOpen = forceState !== undefined ? forceState : !this.isOpen;

        if (this.isOpen) {
            this.toggleBtn.textContent = '✕';
            this.root.querySelectorAll('.bubble-item').forEach(el => el.classList.add('visible'));
        } else {
            this.toggleBtn.textContent = this.options.mainIcon;
            this.root.querySelectorAll('.bubble-item').forEach(el => el.classList.remove('visible'));
        }
    }
}

export class Stepper {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            initialStep: 1,
            totalSteps: 6, // Default for I Ching
            onStepChange: () => { },
            onFinalStepCompleted: () => { },
            stepCircleContainerClassName: '',
            stepContainerClassName: '',
            contentClassName: '',
            footerClassName: '',
            backButtonText: 'Back',
            nextButtonText: 'Continue',
            disableStepIndicators: false,
            renderStepIndicator: null, // (step, isActive, isCompleted) => html string
            ...options
        };

        this.currentStep = this.options.initialStep;
        this.render();
    }

    setStep(step) {
        if (step < 1) step = 1;
        if (step > this.options.totalSteps + 1) step = this.options.totalSteps + 1;
        this.currentStep = step;

        this.options.onStepChange(this.currentStep);
        this.render();

        if (this.currentStep > this.options.totalSteps) {
            this.options.onFinalStepCompleted();
        }
    }

    next() {
        this.setStep(this.currentStep + 1);
    }

    back() {
        this.setStep(this.currentStep - 1);
    }

    render() {
        if (!this.container) return;

        // Custom Class Names
        const cStepContainer = `stepper-row ${this.options.stepContainerClassName || ''}`;
        const cCircleContainer = `stepper-indicators ${this.options.stepCircleContainerClassName || ''}`;

        // Indicators
        let indicatorsHTML = '';
        for (let i = 1; i <= this.options.totalSteps; i++) {
            const isActive = i === this.currentStep;
            const isCompleted = i < this.currentStep;

            let content = '';
            if (this.options.renderStepIndicator) {
                content = this.options.renderStepIndicator(i, isActive, isCompleted);
            } else {
                // Default Ink Style
                let classes = "step-dot";
                if (isActive) classes += " active";
                if (isCompleted) classes += " completed";
                content = `<div class="${classes}">${i}</div>`;
            }

            indicatorsHTML += content;
            // Add connector/line if not last
            if (i < this.options.totalSteps) {
                indicatorsHTML += `<div class="step-line ${isCompleted ? 'completed' : ''}"></div>`;
            }
        }

        this.container.innerHTML = `
      <div class="${cStepContainer}">
         <div class="${cCircleContainer}">
            ${indicatorsHTML}
         </div>
      </div>
    `;

        // Note: We don't render content/footer here automatically because 
        // the app logic controls the main view content (Coins, etc.) based on other state.
        // The Stepper here acts primarily as the Visual Indicator Controller 
        // to match the requested component prop style but adapted for our non-React render loop.
    }
}

export class InkGalaxy {
    constructor(options = {}) {
        this.options = {
            starSpeed: 0.2, // Movement speed
            rotationSpeed: 0.05, // Galaxy rotation
            count: 150,
            colors: ["rgba(0,0,0,0.1)", "rgba(39,74,120,0.1)", "rgba(255,255,255,0.05)"],
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
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.zIndex = '-1';
        this.canvas.style.pointerEvents = 'none'; // Allow clicks through
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Mouse interaction for subtle repulsion
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
            // Spiral galaxy distribution
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * (Math.max(this.canvas.width, this.canvas.height) * 0.8);

            this.particles.push({
                x: this.canvas.width / 2 + Math.cos(angle) * radius,
                y: this.canvas.height / 2 + Math.sin(angle) * radius,
                size: 0.5 + Math.random() * 2,
                color: this.options.colors[Math.floor(Math.random() * this.options.colors.length)],
                angle: angle,
                radius: radius,
                speed: this.options.starSpeed * (Math.random() * 0.5 + 0.5),
                offset: Math.random() * 100
            });
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Center of galaxy
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;

        this.particles.forEach(p => {
            // Spiral Rotation
            p.angle += this.options.rotationSpeed * 0.005; // Base rotation

            // Calculate target position based on rotation
            let tx = cx + Math.cos(p.angle) * p.radius;
            let ty = cy + Math.sin(p.angle) * p.radius;

            // Mouse Repulsion (Ink moving away from finger)
            const dx = tx - this.mouseX;
            const dy = ty - this.mouseY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 200) {
                const force = (200 - dist) / 200;
                const repulsion = 40 * force;
                tx += (dx / dist) * repulsion;
                ty += (dy / dist) * repulsion;
            }

            // Draw Ink Dot
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
            maxTilt: 15, // deg
            perspective: 1000,
            scale: 1.05,
            speed: 400, // ms transition for reset
            glare: true,
            glareOpacity: 0.4,
            ...options
        };
        this.init();
    }

    init() {
        this.element.style.transformStyle = "preserve-3d";
        this.element.style.transform = `perspective(${this.options.perspective}px)`;

        // Glare element
        if (this.options.glare) {
            this.glareEl = document.createElement("div");
            this.glareEl.className = "tilt-glare";
            this.glareEl.style.position = "absolute";
            this.glareEl.style.top = "0";
            this.glareEl.style.left = "0";
            this.glareEl.style.width = "100%";
            this.glareEl.style.height = "100%";
            this.glareEl.style.background = "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.8), transparent 70%)";
            this.glareEl.style.opacity = "0";
            this.glareEl.style.pointerEvents = "none";
            this.glareEl.style.mixBlendMode = "overlay";
            this.glareEl.style.zIndex = "2";
            this.element.appendChild(this.glareEl);
        }

        this.element.addEventListener("mousemove", this.onMove.bind(this));
        this.element.addEventListener("mouseleave", this.onLeave.bind(this));
    }

    onMove(e) {
        const rect = this.element.getBoundingClientRect();
        const x = e.clientX - rect.left; // x position within the element
        const y = e.clientY - rect.top;  // y position within the element

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -this.options.maxTilt;
        const rotateY = ((x - centerX) / centerX) * this.options.maxTilt;

        this.element.style.transition = "none";
        this.element.style.transform = `
       perspective(${this.options.perspective}px) 
       rotateX(${rotateX}deg) 
       rotateY(${rotateY}deg) 
       scale3d(${this.options.scale}, ${this.options.scale}, ${this.options.scale})
     `;

        if (this.options.glare) {
            const glareX = (x / rect.width) * 100;
            const glareY = (y / rect.height) * 100;
            this.glareEl.style.background = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,${this.options.glareOpacity}), transparent 70%)`;
            this.glareEl.style.opacity = "1";
        }
    }

    onLeave() {
        this.element.style.transition = `transform ${this.options.speed}ms ease-out`;
        this.element.style.transform = `perspective(${this.options.perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)`;

        if (this.options.glare) {
            this.glareEl.style.transition = `opacity ${this.options.speed}ms`;
            this.glareEl.style.opacity = "0";
        }
    }
}

// Deprecated: simple particle system
export class ParticleSystem {
    // Keeping as stub to not break existing imports if any, 
    // but functionality is now better served by InkGalaxy or could be aliased.
    constructor(options) {
        // No-op or alias to InkGalaxy
        return new InkGalaxy(options);
    }
}
