import { FoxAnimations } from './avatar-animations.js';
import { FoxMorphs } from './avatar-morphs.js';
import { FoxTheme } from './avatar-theme.js';

export class FoxStateMachine {
    constructor(svgRoot) {
        this.root = typeof svgRoot === 'string' ? document.querySelector(svgRoot) : svgRoot;
        this.animations = new FoxAnimations(this.root);
        this.morphs = new FoxMorphs(this.root);

        this.currentState = null;
        this.paused = false;

        this.blinkTiming = FoxTheme.timing.blinkBase;
        this.lastBlink = performance.now();
        this.nextBlinkDelay = this.getRandomBlinkDelay();
        this.pendingTimeouts = new Set();

        this._loop = this._loop.bind(this);
        this.rafId = requestAnimationFrame(this._loop);
    }

    destroy() {
        this.paused = true;
        cancelAnimationFrame(this.rafId);
        this.clearPendingTimeouts();
        this.animations.stopIdle();
    }

    pause() {
        this.paused = true;
        this.clearPendingTimeouts();
        this.animations.stopIdle();
    }

    resume() {
        this.paused = false;
        if (this.currentState === 'idle_calm') {
            this.animations.startIdle();
        }
        this.rafId = requestAnimationFrame(this._loop);
    }

    getRandomBlinkDelay() {
        return 5000 + Math.random() * 6000;
    }

    queueTimeout(fn, delay) {
        const timeoutId = setTimeout(() => {
            this.pendingTimeouts.delete(timeoutId);
            if (this.paused) return;
            fn();
        }, delay);
        this.pendingTimeouts.add(timeoutId);
        return timeoutId;
    }

    clearPendingTimeouts() {
        this.pendingTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
        this.pendingTimeouts.clear();
    }

    _loop(timestamp) {
        if (this.paused) return;

        // Auto Blink & Micro-Idle Scheduler (only in states where eyes are open)
        if (this.currentState !== 'rest_eyes_closed' && this.currentState !== 'ritual_trace') {
            // Blink logic
            if (timestamp - this.lastBlink > this.nextBlinkDelay) {
                this.morphs.blink(this.blinkTiming);
                this.lastBlink = timestamp;
                this.nextBlinkDelay = this.getRandomBlinkDelay();

                // Natural clustered blink: sometimes a quick follow-up blink.
                if (Math.random() < 0.22) {
                    const quickDelay = 120 + Math.random() * 120;
                    this.queueTimeout(() => this.morphs.blink(this.blinkTiming * 0.75), quickDelay);
                }

                // 30% chance of a secondary micro-movement after a blink
                if (Math.random() < 0.3) {
                    this.queueTimeout(() => {
                        const dice = Math.random();
                        if (dice < 0.5) this.animations.flickerEar(Math.random() > 0.5 ? 'left' : 'right');
                        else if (dice < 0.8) this.animations.tiltHead(Math.random() > 0.5 ? 'left' : 'right');
                    }, 400);
                }
            }
        }

        this.rafId = requestAnimationFrame(this._loop);
    }

    async transitionTo(newState) {
        if (this.paused) return;
        if (this.currentState === newState) return;

        this.currentState = newState;

        if (newState !== 'idle_calm' && newState !== 'rest_eyes_closed' && newState !== 'listen' && newState !== 'guide_present') {
            this.animations.stopIdle();
        }

        switch (newState) {
            case 'idle_calm':
                await this.morphs.setEyesOpen();
                await this.morphs.setMouth('neutral');
                this.animations.startIdle();
                break;

            case 'blink_soft':
                await this.morphs.blink(this.blinkTiming * 1.5);
                this.transitionTo('idle_calm');
                break;

            case 'listen':
                this.animations.startIdle();
                this.animations.flickerEar('left');
                this.queueTimeout(() => this.animations.flickerEar('right'), 400);
                this.queueTimeout(() => this.transitionTo('idle_calm'), 2000);
                break;

            case 'look_left':
                await this.animations.look('left');
                this.transitionTo('idle_calm');
                break;

            case 'look_right':
                await this.animations.look('right');
                this.transitionTo('idle_calm');
                break;

            case 'affirm_nod':
                await this.morphs.setMouth('soft');
                // Additional secondary motion for a "premium" feel
                this.animations.excitedTail();
                await this.animations.nod();
                await this.morphs.setMouth('neutral');
                this.transitionTo('idle_calm');
                break;

            case 'rest_eyes_closed':
                this.animations.startIdle();
                await this.morphs.setEyesClosed();
                break;

            case 'guide_present':
                this.animations.startIdle();
                await this.morphs.setEyesOpen();
                await this.morphs.setMouth('soft');
                await this.animations.guidePresent();
                await this.morphs.setMouth('neutral');
                this.transitionTo('idle_calm');
                break;

            case 'ritual_trace':
                await this.morphs.setEyesClosed();
                const halo = this.root.querySelector('#fox-halo circle');
                if (halo) {
                    halo.style.strokeDashoffset = '880';
                    halo.animate([
                        { strokeDashoffset: '880' },
                        { strokeDashoffset: '0' }
                    ], {
                        duration: FoxTheme.timing.ritualTrace,
                        fill: 'forwards',
                        easing: 'ease-in-out'
                    });
                }
                this.queueTimeout(() => this.transitionTo('rest_eyes_closed'), FoxTheme.timing.ritualTrace);
                break;

            default:
                this.transitionTo('idle_calm');
        }
    }
}
