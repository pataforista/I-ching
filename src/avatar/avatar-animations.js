import { FoxTheme } from './avatar-theme.js';

export class FoxAnimations {
    constructor(svgRoot) {
        this.root = typeof svgRoot === 'string' ? document.querySelector(svgRoot) : svgRoot;
        this.getLayer = (id) => this.root.querySelector(`#${id}`);

        this.layers = {
            body:       this.getLayer('fox-body'),
            head:       this.getLayer('fox-head'),
            tail:       this.getLayer('fox-tail-base'),
            earLeft:    this.getLayer('fox-ear-left'),
            earRight:   this.getLayer('fox-ear-right'),
            halo:       this.getLayer('fox-halo'),
            character:  this.getLayer('fox-character'),
            whiskers:   this.getLayer('fox-whiskers'),
            paws:       this.getLayer('fox-paws'),
            cheeks:     this.getLayer('fox-cheeks'),
            browLeft:   this.getLayer('fox-brow-left'),
            browRight:  this.getLayer('fox-brow-right'),
        };

        this.activeAnimations = [];
    }

    // ─────────────────────────────────────────
    //  IDLE  — breathing + tail + halo + head bob
    // ─────────────────────────────────────────
    startIdle() {
        this.stopIdle();
        if (!this.layers.body || !this.layers.head || !this.layers.tail) return;

        const { timing, amplitudes } = FoxTheme;

        // Torso breathing — gentle down-up with subtle X sway
        const bodyAnim = this.layers.body.animate([
            { transform: 'translateY(0px) scaleX(1)' },
            { transform: `translateY(${amplitudes.torsoY * 0.5}px) scaleX(1.005)` },
            { transform: `translateY(${amplitudes.torsoY}px) scaleX(1.01)` },
            { transform: `translateY(${amplitudes.torsoY * 0.5}px) scaleX(1.005)` },
            { transform: 'translateY(0px) scaleX(1)' }
        ], {
            duration: timing.breathTorso,
            iterations: Infinity,
            easing: 'ease-in-out'
        });

        // Head breathing — offset phase so it bobs slightly different from body
        const headAnim = this.layers.head.animate([
            { transform: 'translateY(0px) rotate(0deg)' },
            { transform: `translateY(${amplitudes.headY * 0.4}px) rotate(0.3deg)` },
            { transform: `translateY(${amplitudes.headY}px) rotate(0deg)` },
            { transform: `translateY(${amplitudes.headY * 0.6}px) rotate(-0.2deg)` },
            { transform: 'translateY(0px) rotate(0deg)' }
        ], {
            duration: timing.breathHead,
            iterations: Infinity,
            easing: 'ease-in-out'
        });

        // Tail sway — asymmetric for natural feel
        const tailAnim = this.layers.tail.animate([
            { transform: 'rotate(0deg)'  },
            { transform: `rotate(${amplitudes.tailRot}deg)` },
            { transform: `rotate(${amplitudes.tailRot * 0.6}deg)` },
            { transform: `rotate(${amplitudes.tailRot * 1.1}deg)` },
            { transform: `rotate(${amplitudes.tailRot * 0.3}deg)` },
            { transform: 'rotate(0deg)' }
        ], {
            duration: timing.tailSway,
            iterations: Infinity,
            easing: 'ease-in-out',
            delay: 300
        });

        // Halo slow breathe — iridescent pulse
        const haloAnim = this.layers.halo?.animate([
            { opacity: 0.60, transform: 'scale(1) rotate(0deg)' },
            { opacity: 0.72, transform: 'scale(1.025) rotate(0.5deg)' },
            { opacity: 0.78, transform: 'scale(1.04) rotate(0deg)' },
            { opacity: 0.72, transform: 'scale(1.025) rotate(-0.5deg)' },
            { opacity: 0.60, transform: 'scale(1) rotate(0deg)' }
        ], {
            duration: 5200,
            iterations: Infinity,
            easing: 'ease-in-out'
        });

        // Paws gentle float
        const pawsAnim = this.layers.paws?.animate([
            { transform: 'translateY(0px)' },
            { transform: `translateY(${amplitudes.torsoY * 0.5}px)` },
            { transform: 'translateY(0px)' }
        ], {
            duration: timing.breathTorso,
            iterations: Infinity,
            easing: 'ease-in-out'
        });

        if (haloAnim)  this.activeAnimations.push(haloAnim);
        if (pawsAnim)  this.activeAnimations.push(pawsAnim);
        this.activeAnimations.push(bodyAnim, headAnim, tailAnim);
    }

    stopIdle() {
        this.activeAnimations.forEach(a => a.cancel());
        this.activeAnimations = [];
    }

    // ─────────────────────────────────────────
    //  EXISTING INTERACTIONS (improved)
    // ─────────────────────────────────────────

    /** Smooth nod with slight return overshoot */
    async nod() {
        if (!this.layers.head) return;
        const duration = FoxTheme.timing.nodBase + (Math.random() * 230 - 80);
        const deg = FoxTheme.amplitudes.nodRot;
        const anim = this.layers.head.animate([
            { transform: 'rotate(0deg)' },
            { transform: `rotate(${deg}deg)`, offset: 0.45 },
            { transform: `rotate(${deg * -0.12}deg)`, offset: 0.78 },
            { transform: 'rotate(0deg)' }
        ], {
            duration,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
        });
        return anim.finished;
    }

    /** Look with smooth ease + tiny overshoot */
    async look(direction) {
        if (!this.layers.head) return;
        const duration = FoxTheme.timing.lookBase + (Math.random() * 200 - 100);
        const x = direction === 'left' ? -FoxTheme.amplitudes.lookX : FoxTheme.amplitudes.lookX;
        const anim = this.layers.head.animate([
            { transform: 'translateX(0px)' },
            { transform: `translateX(${x * 1.15}px)`, offset: 0.55 },
            { transform: `translateX(${x}px)`, offset: 0.75 },
            { transform: 'translateX(0px)' }
        ], {
            duration,
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        });
        return anim.finished;
    }

    /** Quick ear twitch */
    twitchEar(side) {
        const ear = side === 'left' ? this.layers.earLeft : this.layers.earRight;
        if (!ear) return;
        const dir = side === 'left' ? -1 : 1;
        ear.animate([
            { transform: 'rotate(0deg)' },
            { transform: `rotate(${dir * 6}deg)` },
            { transform: 'rotate(0deg)' }
        ], { duration: 160, easing: 'ease-out' });
    }

    /** Head tilt with smooth return */
    async tiltHead(direction = 'left') {
        if (!this.layers.head) return;
        const angle = direction === 'left' ? -5 : 5;
        const anim = this.layers.head.animate([
            { transform: 'rotate(0deg)' },
            { transform: `rotate(${angle}deg)`, offset: 0.40 },
            { transform: `rotate(${angle * 0.85}deg)`, offset: 0.70 },
            { transform: 'rotate(0deg)' }
        ], {
            duration: 900,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
        });
        return anim.finished;
    }

    /** Flicker ear — multi-bounce with natural damping */
    flickerEar(side = 'left') {
        const ear = side === 'left' ? this.layers.earLeft : this.layers.earRight;
        if (!ear) return;
        const d = side === 'left' ? -1 : 1;
        ear.animate([
            { transform: 'rotate(0deg)' },
            { transform: `rotate(${d * 14}deg)`, offset: 0.20 },
            { transform: `rotate(${d * -4}deg)`, offset: 0.45 },
            { transform: `rotate(${d * 9}deg)`,  offset: 0.65 },
            { transform: `rotate(${d * -2}deg)`, offset: 0.82 },
            { transform: 'rotate(0deg)' }
        ], {
            duration: 300,
            easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)'
        });
    }

    /** Excited tail wag — more frames, more energy */
    async excitedTail() {
        if (!this.layers.tail) return;
        const anim = this.layers.tail.animate([
            { transform: 'rotate(0deg)' },
            { transform: 'rotate(18deg)',  offset: 0.18 },
            { transform: 'rotate(-8deg)',  offset: 0.36 },
            { transform: 'rotate(14deg)',  offset: 0.54 },
            { transform: 'rotate(-4deg)',  offset: 0.72 },
            { transform: 'rotate(6deg)',   offset: 0.88 },
            { transform: 'rotate(0deg)' }
        ], {
            duration: 700,
            easing: 'ease-in-out'
        });
        return anim.finished;
    }

    /** Guide present — halo flares up with glow */
    guidePresent() {
        if (!this.layers.halo) return;
        return this.layers.halo.animate([
            { transform: 'scale(1)',    opacity: 0.78 },
            { transform: 'scale(1.06)', opacity: 1,   offset: 0.40 },
            { transform: 'scale(1.04)', opacity: 0.95, offset: 0.65 },
            { transform: 'scale(1)',    opacity: 0.78 }
        ], {
            duration: 2800,
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            iterations: 1
        }).finished;
    }

    // ─────────────────────────────────────────
    //  NEW ANIMATIONS
    // ─────────────────────────────────────────

    /** Happy bounce — whole character hops up and down */
    async bounce() {
        if (!this.layers.character) return;
        const anim = this.layers.character.animate([
            { transform: 'translateY(0px) scaleY(1) scaleX(1)' },
            { transform: 'translateY(-12px) scaleY(1.04) scaleX(0.97)', offset: 0.30 },
            { transform: 'translateY(0px) scaleY(0.96) scaleX(1.03)',   offset: 0.55 },
            { transform: 'translateY(-5px) scaleY(1.02) scaleX(0.99)',  offset: 0.72 },
            { transform: 'translateY(0px) scaleY(1) scaleX(1)' }
        ], {
            duration: 560,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
        });
        return anim.finished;
    }

    /** Sniff — head dips down and wiggles slightly */
    async sniff() {
        if (!this.layers.head) return;
        const anim = this.layers.head.animate([
            { transform: 'translateY(0px) rotate(0deg)' },
            { transform: 'translateY(3px) rotate(2deg)',   offset: 0.25 },
            { transform: 'translateY(5px) rotate(-1deg)',  offset: 0.50 },
            { transform: 'translateY(3px) rotate(1.5deg)', offset: 0.72 },
            { transform: 'translateY(0px) rotate(0deg)' }
        ], {
            duration: 700,
            easing: 'ease-in-out'
        });
        return anim.finished;
    }

    /** Look up — contemplative upward gaze */
    async lookUp() {
        if (!this.layers.head) return;
        const anim = this.layers.head.animate([
            { transform: 'translateY(0px) rotate(0deg)' },
            { transform: 'translateY(-4px) rotate(-4deg)', offset: 0.40 },
            { transform: 'translateY(-3px) rotate(-3deg)', offset: 0.65 },
            { transform: 'translateY(0px) rotate(0deg)' }
        ], {
            duration: 950,
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        });
        return anim.finished;
    }

    /** Shake head — quick vigorous left-right */
    async shakeHead() {
        if (!this.layers.head) return;
        const anim = this.layers.head.animate([
            { transform: 'rotate(0deg)' },
            { transform: 'rotate(-9deg)',  offset: 0.15 },
            { transform: 'rotate(9deg)',   offset: 0.35 },
            { transform: 'rotate(-6deg)',  offset: 0.55 },
            { transform: 'rotate(5deg)',   offset: 0.72 },
            { transform: 'rotate(-2deg)',  offset: 0.88 },
            { transform: 'rotate(0deg)' }
        ], {
            duration: 550,
            easing: 'linear'
        });
        return anim.finished;
    }

    /** Tail flick — single quick snap */
    async tailFlick() {
        if (!this.layers.tail) return;
        const anim = this.layers.tail.animate([
            { transform: 'rotate(0deg)' },
            { transform: 'rotate(22deg)',  offset: 0.22 },
            { transform: 'rotate(-6deg)',  offset: 0.55 },
            { transform: 'rotate(3deg)',   offset: 0.78 },
            { transform: 'rotate(0deg)' }
        ], {
            duration: 420,
            easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)'
        });
        return anim.finished;
    }

    /** Whisker twitch — subtle whisker animation */
    whiskerTwitch() {
        const w = this.layers.whiskers;
        if (!w) return;
        w.animate([
            { opacity: 0.50, transform: 'scaleX(1)' },
            { opacity: 0.65, transform: 'scaleX(1.04)', offset: 0.30 },
            { opacity: 0.50, transform: 'scaleX(1)' }
        ], {
            duration: 280,
            easing: 'ease-in-out'
        });
    }

    /** Brow raise — curious / surprised expression */
    browRaise() {
        const bl = this.layers.browLeft;
        const br = this.layers.browRight;
        if (!bl && !br) return;
        const opts = { duration: 500, easing: 'ease-in-out' };
        bl?.animate([
            { transform: 'translateY(0px)' },
            { transform: 'translateY(-3px)', offset: 0.40 },
            { transform: 'translateY(0px)' }
        ], opts);
        br?.animate([
            { transform: 'translateY(0px)' },
            { transform: 'translateY(-3px)', offset: 0.40 },
            { transform: 'translateY(0px)' }
        ], opts);
    }

    /** Cheek blush pulse — shy / happy moment */
    cheekPulse() {
        const c = this.layers.cheeks;
        if (!c) return;
        c.animate([
            { opacity: 0.92, transform: 'scale(1)' },
            { opacity: 1,    transform: 'scale(1.10)', offset: 0.40 },
            { opacity: 0.92, transform: 'scale(1)' }
        ], {
            duration: 600,
            easing: 'ease-in-out'
        });
    }

    /** Float up — magical levitation for oracle moment */
    async floatUp(duration = 1800) {
        if (!this.layers.character) return;
        const anim = this.layers.character.animate([
            { transform: 'translateY(0px)' },
            { transform: 'translateY(-8px)', offset: 0.50 },
            { transform: 'translateY(0px)' }
        ], {
            duration,
            easing: 'ease-in-out'
        });
        return anim.finished;
    }

    /** Stretch yawn — big lazy stretch */
    async stretchYawn() {
        if (!this.layers.character) return;
        const anim = this.layers.character.animate([
            { transform: 'scaleY(1) translateY(0px)' },
            { transform: 'scaleY(1.05) translateY(-4px)', offset: 0.35 },
            { transform: 'scaleY(0.97) translateY(2px)',  offset: 0.70 },
            { transform: 'scaleY(1) translateY(0px)' }
        ], {
            duration: 1100,
            easing: 'ease-in-out'
        });
        // Also animate ears spreading
        this.flickerEar('left');
        setTimeout(() => this.flickerEar('right'), 120);
        return anim.finished;
    }
}
