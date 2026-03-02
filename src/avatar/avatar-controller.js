/**
 * Public API for the Fox Avatar System.
 * Coordinates WAAPI animations, state machine, and D3 morphs.
 */
import { FoxStateMachine } from './avatar-state-machine.js';
import { setupAvatarAccessibility } from './avatar-accessibility.js';
import { initFoxEvents } from './avatar-events.js';

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

        // Load the SVG content
        try {
            const res = await fetch('./src/avatar/fox.svg');
            const svgText = await res.text();
            this.container.innerHTML = svgText;

            // Setup internal systems
            this.stateMachine = new FoxStateMachine(this.container);
            setupAvatarAccessibility(this.stateMachine);
            initFoxEvents(this);

            this.isReady = true;
            this.setState('idle_calm');

        } catch (e) {
            console.error("Failed to load Fox Avatar:", e);
        }
    }

    setState(stateName) {
        if (!this.isReady || !this.stateMachine) return;
        this.stateMachine.transitionTo(stateName);
    }

    dispatchEvent(eventName, payload) {
        // avatar-events.js listens to this and triggers state changes
        const e = new CustomEvent('fox_event', { detail: { eventName, payload } });
        document.dispatchEvent(e);
    }

    pause() {
        if (this.stateMachine) this.stateMachine.pause();
    }

    resume() {
        if (this.stateMachine) this.stateMachine.resume();
    }

    destroy() {
        if (this.stateMachine) this.stateMachine.destroy();
        if (this.container) this.container.innerHTML = '';
        this.isReady = false;
    }
}
