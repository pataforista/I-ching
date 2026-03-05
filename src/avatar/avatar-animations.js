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

        // Torso breathing — organic sine-like feel with cubic-bezier
        const bodyAnim = this.layers.body.animate([
            { transform: 'translateY(0px)' },
            { transform: `translateY(${amplitudes.torsoY}px)` },
            { transform: 'translateY(0px)' }
        ], {
            duration: timing.breathTorso,
            iterations: Infinity,
            easing: 'cubic-bezier(0.37, 0, 0.63, 1)' // smooth sine wave
        });

        // Head breathing — slightly offset phase for natural dissociation
        const headAnim = this.layers.head.animate([
            { transform: 'translateY(0px)' },
            { transform: `translateY(${amplitudes.headY}px)` },
            { transform: 'translateY(0px)' }
        ], {
            duration: timing.breathHead,
            iterations: Infinity,
            easing: 'cubic-bezier(0.37, 0, 0.63, 1)',
            delay: 180 // slight phase offset from torso
        });

        // Tail sway — pendulum feel: slow out, slow in, weighted
        const tailAnim = this.layers.tail.animate([
            { transform: 'rotate(0deg)' },
            { transform: `rotate(${amplitudes.tailRot}deg)` },
            { transform: 'rotate(0deg)' }
        ], {
            duration: timing.tailSway,
            iterations: Infinity,
            easing: 'cubic-bezier(0.45, 0.05, 0.55, 0.95)', // pendulum
            delay: 300
        });

        const haloAnim = this.layers.halo?.animate([
            { opacity: 0.62, transform: 'scale(1)' },
            { opacity: 0.78, transform: 'scale(1.03)' },
            { opacity: 0.62, transform: 'scale(1)' }
        ], {
            duration: 4200,
            iterations: Infinity,
            easing: 'ease-in-out'
        });

        if (haloAnim) this.activeAnimations.push(haloAnim);
        this.activeAnimations.push(bodyAnim, headAnim, tailAnim);
    }

    stopIdle() {
        this.activeAnimations.forEach(a => a.cancel());
        this.activeAnimations = [];
    }

    async nod() {
        if (!this.layers.head) return;
        const duration = FoxTheme.timing.nodBase + (Math.random() * 230 - 80);
        // Slight overshoot bounce for weight: goes past 0 then settles
        const anim = this.layers.head.animate([
            { transform: 'rotate(0deg)',                              easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
            { transform: `rotate(${FoxTheme.amplitudes.nodRot}deg)`, easing: 'cubic-bezier(0.34, 1.2, 0.64, 1)' },
            { transform: 'rotate(0deg)' }
        ], { duration });
        return anim.finished;
    }

    async look(direction) {
        if (!this.layers.head) return;
        const duration = FoxTheme.timing.lookBase + (Math.random() * 200 - 100);
        const x = direction === 'left' ? -FoxTheme.amplitudes.lookX : FoxTheme.amplitudes.lookX;
        // Quick move then gentle return with slight overshoot
        const anim = this.layers.head.animate([
            { transform: 'translateX(0px)',  easing: 'cubic-bezier(0.25, 1, 0.5, 1)' },
            { transform: `translateX(${x}px)`, easing: 'cubic-bezier(0.34, 1.3, 0.64, 1)' },
            { transform: 'translateX(0px)' }
        ], { duration });
        return anim.finished;
    }

    twitchEar(side) {
        const ear = side === 'left' ? this.layers.earLeft : this.layers.earRight;
        if (!ear) return;
        const dir = side === 'left' ? -6 : 6;
        ear.animate([
            { transform: 'rotate(0deg)',          easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' },
            { transform: `rotate(${dir}deg)`,     easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
            { transform: `rotate(${dir * 0.3}deg)`, easing: 'cubic-bezier(0.34, 1.2, 0.64, 1)' },
            { transform: 'rotate(0deg)' }
        ], {
            duration: 240,
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
