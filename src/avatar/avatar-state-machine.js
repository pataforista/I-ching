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
        // Natural variance: 4.5s – 10s
        return 4500 + Math.random() * 5500;
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

        // Auto-blink & micro-idle (only when eyes open)
        if (this.currentState !== 'rest_eyes_closed' && this.currentState !== 'ritual_trace') {
            if (timestamp - this.lastBlink > this.nextBlinkDelay) {
                this.morphs.blink(this.blinkTiming + Math.random() * 60);
                this.lastBlink = timestamp;
                this.nextBlinkDelay = this.getRandomBlinkDelay();

                // Natural double-blink (~20% chance)
                if (Math.random() < 0.20) {
                    const quickDelay = 110 + Math.random() * 130;
                    this.queueTimeout(() => this.morphs.blink(this.blinkTiming * 0.80), quickDelay);
                }

                // Micro-movement after blink (~35% chance) — expanded set
                if (Math.random() < 0.35) {
                    this.queueTimeout(() => {
                        const dice = Math.random();
                        if      (dice < 0.28) this.animations.flickerEar(Math.random() > 0.5 ? 'left' : 'right');
                        else if (dice < 0.52) this.animations.tiltHead(Math.random() > 0.5 ? 'left' : 'right');
                        else if (dice < 0.68) this.animations.whiskerTwitch?.();
                        else if (dice < 0.82) this.animations.browRaise?.();
                        else                  this.animations.tailFlick?.();
                    }, 350 + Math.random() * 150);
                }
            }

            // Very rare idle special action (~every 30-60s per frame check)
            if (Math.random() < 0.00004) {
                const dice = Math.random();
                if      (dice < 0.40) this.animations.sniff?.();
                else if (dice < 0.65) this.animations.lookUp?.();
                else if (dice < 0.82) this.animations.stretchYawn?.();
                else                  this.animations.cheekPulse?.();
            }
        }

        this.rafId = requestAnimationFrame(this._loop);
    }

    async transitionTo(newState) {
        if (this.paused) return;
        if (this.currentState === newState) return;

        this.currentState = newState;

        // Stop idle for action states (not calm/rest/listen/guide)
        const keepIdleStates = new Set([
            'idle_calm', 'rest_eyes_closed', 'listen', 'guide_present', 'curious', 'thinking'
        ]);
        if (!keepIdleStates.has(newState)) {
            this.animations.stopIdle();
        }

        switch (newState) {

            // ── IDLE ────────────────────────────────────────────
            case 'idle_calm':
                await this.morphs.setEyesOpen();
                await this.morphs.setMouth('neutral');
                this.animations.startIdle();
                break;

            // ── BLINK ───────────────────────────────────────────
            case 'blink_soft':
                await this.morphs.blink(this.blinkTiming * 1.5);
                this.transitionTo('idle_calm');
                break;

            // ── LISTEN ──────────────────────────────────────────
            case 'listen':
                this.animations.startIdle();
                this.animations.flickerEar('left');
                this.queueTimeout(() => this.animations.flickerEar('right'), 380);
                this.queueTimeout(() => this.animations.twitchEar('left'), 750);
                this.queueTimeout(() => this.transitionTo('idle_calm'), 2000);
                break;

            // ── LOOK ────────────────────────────────────────────
            case 'look_left':
                await this.animations.look('left');
                this.transitionTo('idle_calm');
                break;

            case 'look_right':
                await this.animations.look('right');
                this.transitionTo('idle_calm');
                break;

            // ── NOD ─────────────────────────────────────────────
            case 'affirm_nod':
                await this.morphs.setMouth('soft');
                this.animations.excitedTail();
                this.animations.cheekPulse?.();
                await this.animations.nod();
                await this.morphs.setMouth('neutral');
                this.transitionTo('idle_calm');
                break;

            // ── REST ─────────────────────────────────────────────
            case 'rest_eyes_closed':
                this.animations.startIdle();
                await this.morphs.setEyesClosed();
                await this.morphs.setMouth('neutral');
                break;

            // ── GUIDE ────────────────────────────────────────────
            case 'guide_present':
                this.animations.startIdle();
                await this.morphs.setEyesOpen();
                await this.morphs.setMouth('soft');
                this.animations.floatUp?.(2200);
                await this.animations.guidePresent();
                await this.morphs.setMouth('neutral');
                this.transitionTo('idle_calm');
                break;

            // ── RITUAL TRACE ─────────────────────────────────────
            case 'ritual_trace':
                await this.morphs.setEyesClosed();
                {
                    const haloCircle = this.root.querySelector('#fox-halo circle');
                    if (haloCircle) {
                        haloCircle.style.strokeDashoffset = '893';
                        haloCircle.animate([
                            { strokeDashoffset: '893' },
                            { strokeDashoffset: '0' }
                        ], {
                            duration: FoxTheme.timing.ritualTrace,
                            fill: 'forwards',
                            easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
                        });
                    }
                }
                this.queueTimeout(() => this.transitionTo('rest_eyes_closed'), FoxTheme.timing.ritualTrace);
                break;

            // ── CURIOUS (new) ─────────────────────────────────────
            case 'curious':
                this.animations.startIdle();
                await this.morphs.setEyesOpen();
                this.animations.browRaise?.();
                this.animations.tiltHead(Math.random() > 0.5 ? 'left' : 'right');
                this.queueTimeout(() => this.animations.flickerEar('left'), 200);
                this.queueTimeout(() => this.animations.lookUp?.(), 500);
                this.queueTimeout(() => this.transitionTo('idle_calm'), 2200);
                break;

            // ── HAPPY (new) ───────────────────────────────────────
            case 'happy':
                await this.morphs.setMouth('soft');
                this.animations.cheekPulse?.();
                await this.animations.bounce?.();
                this.animations.excitedTail();
                this.queueTimeout(() => this.animations.bounce?.(), 300);
                this.queueTimeout(async () => {
                    await this.morphs.setMouth('neutral');
                    this.transitionTo('idle_calm');
                }, 900);
                break;

            // ── THINKING (new) ────────────────────────────────────
            case 'thinking':
                this.animations.startIdle();
                await this.morphs.setEyesOpen();
                this.animations.tiltHead('left');
                this.queueTimeout(() => this.animations.lookUp?.(), 400);
                this.queueTimeout(() => this.animations.flickerEar('right'), 700);
                this.queueTimeout(() => this.animations.whiskerTwitch?.(), 900);
                this.queueTimeout(() => this.transitionTo('idle_calm'), 2500);
                break;

            // ── SNIFF (new) ───────────────────────────────────────
            case 'sniff':
                this.animations.sniff?.();
                this.queueTimeout(() => this.animations.whiskerTwitch?.(), 200);
                this.queueTimeout(() => this.animations.twitchEar('left'), 350);
                this.queueTimeout(() => this.transitionTo('idle_calm'), 900);
                break;

            // ── STRETCH YAWN (new) ────────────────────────────────
            case 'stretch_yawn':
                await this.animations.stretchYawn?.();
                this.queueTimeout(() => this.transitionTo('idle_calm'), 200);
                break;

            // ── SHAKE HEAD (new) ──────────────────────────────────
            case 'shake_head':
                await this.animations.shakeHead?.();
                this.transitionTo('idle_calm');
                break;

            default:
                this.transitionTo('idle_calm');
        }
    }
}
