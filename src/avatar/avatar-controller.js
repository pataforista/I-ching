/**
 * Public API for the Fox Avatar System.
 * Coordinates WAAPI animations, state machine, and SVG morphs.
 */
import { FoxStateMachine } from './avatar-state-machine.js';
import { setupAvatarAccessibility } from './avatar-accessibility.js';
import { initFoxEvents } from './avatar-events.js';

// Inline Fox SVG — embedded directly to avoid fetch failures (offline, CORS, etc.)
const FOX_SVG_INLINE = `<svg id="fox-root" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
  <defs>
    <linearGradient id="fox-halo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="hsl(156, 30%, 42%)" stop-opacity="0.05" />
      <stop offset="100%" stop-color="hsl(156, 30%, 42%)" stop-opacity="0.15" />
    </linearGradient>
    <linearGradient id="fox-body-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="hsl(14, 75%, 48%)" />
      <stop offset="100%" stop-color="hsl(14, 65%, 35%)" />
    </linearGradient>
    <radialGradient id="fox-head-grad" cx="40%" cy="28%" r="70%">
      <stop offset="0%" stop-color="hsl(15, 78%, 56%)" />
      <stop offset="62%" stop-color="hsl(14, 74%, 47%)" />
      <stop offset="100%" stop-color="hsl(14, 66%, 36%)" />
    </radialGradient>
    <linearGradient id="fox-cheek-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="hsl(340, 95%, 86%)" stop-opacity="0.15"/>
      <stop offset="50%" stop-color="hsl(340, 95%, 84%)" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="hsl(340, 95%, 86%)" stop-opacity="0.15"/>
    </linearGradient>
    <filter id="soft-shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="hsl(240, 6%, 12%)" flood-opacity="0.06"/>
    </filter>
  </defs>

  <!-- Halo / Ensō -->
  <g id="fox-halo" transform="translate(200, 180)" style="transform-origin: 0px 0px;">
    <circle cx="0" cy="0" r="140" fill="url(#fox-halo-grad)" stroke="hsl(156, 30%, 42%)" stroke-width="1.5" stroke-opacity="0.3" stroke-dasharray="880" stroke-dashoffset="0" />
  </g>

  <!-- Shadow -->
  <ellipse id="fox-shadow" cx="200" cy="340" rx="110" ry="15" fill="hsl(240, 6%, 12%)" opacity="0.05" />

  <!-- Fox character -->
  <g id="fox-character" transform="translate(200, 240)">
    <!-- Tail Base -->
    <g id="fox-tail-base" style="transform-origin: -40px 60px;">
      <path d="M 40,80 C 140,90 180,20 120,-20 C 80,-50 20,-30 -20,10 C -50,40 -40,70 40,80 Z" fill="hsl(45, 95%, 55%)" filter="url(#soft-shadow)" />
    </g>

    <!-- Tail Tip -->
    <g id="fox-tail-tip" transform="translate(120, -20)">
      <path d="M 0,0 C -10,-20 10,-30 20,-10 C 20,10 5,10 0,0 Z" fill="hsl(45, 80%, 90%)" />
    </g>

    <!-- Body -->
    <g id="fox-body" style="transform-origin: 0px 40px;">
      <path d="M -50,80 C -60,0 -40,-60 0,-80 C 40,-60 60,0 50,80 Z" fill="url(#fox-body-grad)" filter="url(#soft-shadow)"/>
    </g>

    <!-- Neck / Ruff -->
    <g id="fox-neck" transform="translate(0, -70)">
      <path d="M -35,10 C -45,30 45,30 35,10 C 20,20 -20,20 -35,10 Z" fill="hsl(30, 20%, 98%)" />
    </g>

    <!-- Head Group -->
    <g id="fox-head" style="transform-origin: 0px -80px;" transform="translate(0, -80)">
      <!-- Ears -->
      <g id="fox-ear-left" style="transform-origin: -25px -30px;">
        <path d="M -15,-25 C -30,-50 -45,-60 -45,-30 C -45,-15 -35,-10 -25,0 Z" fill="hsl(14, 70%, 45%)" />
        <path d="M -40,-48 L -45,-55 L -48,-45 Z" fill="hsl(14, 70%, 45%)" />
        <path d="M -35,-52 L -38,-60 L -42,-53 Z" fill="hsl(14, 70%, 45%)" />
        <path d="M -20,-22 C -30,-40 -38,-45 -38,-30 C -38,-20 -30,-15 -25,-5 Z" fill="hsl(15, 40%, 82%)" />
      </g>
      <g id="fox-ear-right" style="transform-origin: 25px -30px;">
        <path d="M 15,-25 C 30,-50 45,-60 45,-30 C 45,-15 35,-10 25,0 Z" fill="hsl(14, 70%, 45%)" />
        <path d="M 40,-48 L 45,-55 L 48,-45 Z" fill="hsl(14, 70%, 45%)" />
        <path d="M 35,-52 L 38,-60 L 42,-53 Z" fill="hsl(14, 70%, 45%)" />
        <path d="M 20,-22 C 30,-40 38,-45 38,-30 C 38,-20 30,-15 25,-5 Z" fill="hsl(15, 40%, 82%)" />
      </g>

      <!-- Head Base -->
      <path d="M -40,-10 C -50,20 0,40 40,-10 C 60,-40 20,-60 0,-60 C -20,-60 -60,-40 -40,-10 Z" fill="url(#fox-head-grad)" filter="url(#soft-shadow)"/>

      <!-- Muzzle -->
      <g id="fox-muzzle">
        <path d="M -15,10 C -15,30 15,30 15,10 C 5,5 -5,5 -15,10 Z" fill="hsl(30, 20%, 98%)" />
        <ellipse cx="0" cy="22" rx="4" ry="3" fill="hsl(240, 6%, 20%)" />
      </g>

      <g id="fox-whiskers" opacity="0.45">
        <path d="M -16,19 Q -28,18 -36,14" fill="none" stroke="hsl(240, 6%, 32%)" stroke-width="1" stroke-linecap="round"/>
        <path d="M 16,19 Q 28,18 36,14" fill="none" stroke="hsl(240, 6%, 32%)" stroke-width="1" stroke-linecap="round"/>
      </g>

      <!-- Cheek Blush -->
      <g id="fox-cheeks" opacity="0.9">
        <ellipse cx="-28" cy="12" rx="8" ry="3.8" fill="url(#fox-cheek-grad)" />
        <ellipse cx="28" cy="12" rx="8" ry="3.8" fill="url(#fox-cheek-grad)" />
        <path d="M -40,5 L -48,2 L -42,10 Z" fill="hsl(14, 75%, 48%)" opacity="0.8" />
        <path d="M 40,5 L 48,2 L 42,10 Z" fill="hsl(14, 75%, 48%)" opacity="0.8" />
      </g>

      <!-- Mouth Morphs -->
      <g id="fox-mouth">
        <path id="fox-mouth-neutral" d="M -6,28 Q 0,30 6,28" fill="none" stroke="hsl(240, 6%, 30%)" stroke-width="1.2" stroke-linecap="round" />
        <path id="fox-mouth-soft" d="M -8,27 Q -4,31 0,28 Q 4,31 8,27" fill="none" stroke="hsl(240, 6%, 30%)" stroke-width="1.2" stroke-linecap="round" style="display:none;" />
      </g>

      <!-- Eyes (Left) -->
      <g id="fox-eye-left">
        <path id="fox-eye-left-open" d="M -22,-2 Q -16,-8 -10,-2 Q -16,2 -22,-2 Z" fill="hsl(240, 6%, 20%)" />
        <circle cx="-19" cy="-4" r="1.5" fill="white" opacity="0.8" />
        <path id="fox-eye-left-half" d="M -22,-2 Q -16,-4 -10,-2 Q -16,-1 -22,-2 Z" fill="hsl(240, 6%, 20%)" style="display:none;" />
        <path id="fox-eye-left-closed" d="M -22,-2 Q -16,0 -10,-2" fill="none" stroke="hsl(240, 6%, 20%)" stroke-width="2.5" stroke-linecap="round" style="display:none;" />
      </g>

      <!-- Eyes (Right) -->
      <g id="fox-eye-right">
        <path id="fox-eye-right-open" d="M 10,-2 Q 16,-8 22,-2 Q 16,2 10,-2 Z" fill="hsl(240, 6%, 20%)" />
        <circle cx="13" cy="-4" r="1.5" fill="white" opacity="0.8" />
        <path id="fox-eye-right-half" d="M 10,-2 Q 16,-4 22,-2 Q 16,-1 10,-2 Z" fill="hsl(240, 6%, 20%)" style="display:none;" />
        <path id="fox-eye-right-closed" d="M 10,-2 Q 16,0 22,-2" fill="none" stroke="hsl(240, 6%, 20%)" stroke-width="2.5" stroke-linecap="round" style="display:none;" />
      </g>

      <!-- Brows -->
      <g id="fox-brow-left">
        <path d="M -24,-12 Q -16,-15 -10,-10" fill="none" stroke="hsl(240, 6%, 60%)" stroke-width="1" stroke-linecap="round" />
      </g>
      <g id="fox-brow-right">
        <path d="M 10,-10 Q 16,-15 24,-12" fill="none" stroke="hsl(240, 6%, 60%)" stroke-width="1" stroke-linecap="round" />
      </g>

      <!-- Zen bead accessory -->
      <g id="fox-accessory" transform="translate(0, -35)">
        <circle cx="0" cy="0" r="3" fill="hsl(38, 30%, 60%)" opacity="0.6"/>
      </g>
    </g>
  </g>
</svg>`;

export class FoxAvatarController {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.options = { ...options };
        this.stateMachine = null;
        this.isReady = false;

        this.init();
    }

    async init() {
        if (!this.container) return;

        try {
            // Use inline SVG directly — avoids fetch(), works offline and locally
            this.container.innerHTML = FOX_SVG_INLINE;

            this.stateMachine = new FoxStateMachine(this.container);
            setupAvatarAccessibility(this.stateMachine);
            initFoxEvents(this);

            this.isReady = true;
            this.setState('idle_calm');

        } catch (e) {
            console.error('Fox Avatar init error:', e);
            // Minimal fallback: just show a glyph
            if (this.container) {
                this.container.innerHTML =
                    `<div style="font-size:clamp(80px,15vw,120px);opacity:0.6;text-align:center;line-height:1;font-family:serif;color:var(--accent);">狐</div>`;
            }
        }
    }

    setState(stateName) {
        if (!this.isReady || !this.stateMachine) return;
        this.stateMachine.transitionTo(stateName);
    }

    dispatchEvent(eventName, payload) {
        document.dispatchEvent(new CustomEvent('fox_event', { detail: { eventName, payload } }));
    }

    pause() { if (this.stateMachine) this.stateMachine.pause(); }
    resume() { if (this.stateMachine) this.stateMachine.resume(); }

    destroy() {
        if (this.stateMachine) this.stateMachine.destroy();
        if (this.container) this.container.innerHTML = '';
        this.isReady = false;
    }
}
