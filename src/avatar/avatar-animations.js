import { FoxTheme } from './avatar-theme.js';

export class FoxAnimations {
    constructor(svgRoot) {
        this.root = typeof svgRoot === 'string' ? document.querySelector(svgRoot) : svgRoot;
        this.getLayer = (id) => this.root.querySelector(`#${id}`);

        this.layers = {
            body: this.getLayer('fox-body'),
            head: this.getLayer('fox-head'),
            tail: this.getLayer('fox-tail-base'),
            earLeft: this.getLayer('fox-ear-left'),
            earRight: this.getLayer('fox-ear-right'),
            halo: this.getLayer('fox-halo'),
            character: this.getLayer('fox-character')
        };

        this.activeAnimations = [];
    }

    startIdle() {
        this.stopIdle();
        if (!this.layers.body || !this.layers.head || !this.layers.tail) return;

        const { timing, amplitudes } = FoxTheme;

        // Torso breathing
        const bodyAnim = this.layers.body.animate([
            { transform: 'translateY(0px)' },
            { transform: `translateY(${amplitudes.torsoY}px)` },
            { transform: 'translateY(0px)' }
        ], {
            duration: timing.breathTorso,
            iterations: Infinity,
            easing: 'ease-in-out'
        });

        // Head breathing (same phase, less amplitude)
        const headAnim = this.layers.head.animate([
            { transform: 'translateY(0px)' },
            { transform: `translateY(${amplitudes.headY}px)` },
            { transform: 'translateY(0px)' }
        ], {
            duration: timing.breathHead,
            iterations: Infinity,
            easing: 'ease-in-out'
        });

        // Tail sway 
        const tailAnim = this.layers.tail.animate([
            { transform: 'rotate(0deg)' },
            { transform: `rotate(${amplitudes.tailRot}deg)` },
            { transform: 'rotate(0deg)' }
        ], {
            duration: timing.tailSway,
            iterations: Infinity,
            easing: 'ease-in-out',
            delay: 500
        });

        this.activeAnimations.push(bodyAnim, headAnim, tailAnim);
    }

    stopIdle() {
        this.activeAnimations.forEach(a => a.cancel());
        this.activeAnimations = [];
    }

    async nod() {
        if (!this.layers.head) return;
        // Add randomness to nod
        const duration = FoxTheme.timing.nodBase + (Math.random() * 230 - 80);
        const anim = this.layers.head.animate([
            { transform: 'rotate(0deg)' },
            { transform: `rotate(${FoxTheme.amplitudes.nodRot}deg)` },
            { transform: 'rotate(0deg)' }
        ], {
            duration,
            easing: 'ease-in-out'
        });
        return anim.finished;
    }

    async look(direction) {
        if (!this.layers.head) return;
        const duration = FoxTheme.timing.lookBase + (Math.random() * 200 - 100);
        const x = direction === 'left' ? -FoxTheme.amplitudes.lookX : FoxTheme.amplitudes.lookX;
        const anim = this.layers.head.animate([
            { transform: 'translateX(0px)' },
            { transform: `translateX(${x}px)` },
            { transform: 'translateX(0px)' }
        ], {
            duration: duration,
            easing: 'ease-in-out'
        });
        return anim.finished;
    }

    twitchEar(side) {
        const ear = side === 'left' ? this.layers.earLeft : this.layers.earRight;
        if (!ear) return;
        ear.animate([
            { transform: 'rotate(0deg)' },
            { transform: side === 'left' ? 'rotate(-5deg)' : 'rotate(5deg)' },
            { transform: 'rotate(0deg)' }
        ], {
            duration: 150,
            easing: 'ease-out'
        });
    }

    guidePresent() {
        if (!this.layers.halo) return;
        return this.layers.halo.animate([
            { transform: 'scale(1)', opacity: 0.8 },
            { transform: 'scale(1.05)', opacity: 1 },
            { transform: 'scale(1)', opacity: 0.8 }
        ], {
            duration: 3000,
            easing: 'ease-in-out',
            iterations: 1
        }).finished;
    }
}
