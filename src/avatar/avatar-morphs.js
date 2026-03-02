import { interpolatePath } from 'https://cdn.jsdelivr.net/npm/d3-interpolate-path@2.3.0/+esm';

export class FoxMorphs {
    constructor(svgRoot) {
        this.root = typeof svgRoot === 'string' ? document.querySelector(svgRoot) : svgRoot;

        this.eyesLeft = {
            open: this.getPath('fox-eye-left-open'),
            half: this.getPath('fox-eye-left-half'),
            closed: this.getPath('fox-eye-left-closed')
        };
        this.eyesRight = {
            open: this.getPath('fox-eye-right-open'),
            half: this.getPath('fox-eye-right-half'),
            closed: this.getPath('fox-eye-right-closed')
        };
        this.mouths = {
            neutral: this.getPath('fox-mouth-neutral'),
            soft: this.getPath('fox-mouth-soft')
        };

        // We animate the primary visible path node
        this.activeMouth = this.getLayer('fox-mouth-neutral');
        this.activeLeftEye = this.getLayer('fox-eye-left-open');
        this.activeRightEye = this.getLayer('fox-eye-right-open');
    }

    getLayer(id) {
        return this.root.querySelector(`#${id}`);
    }

    getPath(id) {
        const el = this.getLayer(id);
        return el ? el.getAttribute('d') : '';
    }

    morphElement(element, startD, endD, duration) {
        if (!element || !startD || !endD) return Promise.resolve();

        return new Promise(resolve => {
            const interpolator = interpolatePath(startD, endD);
            let start = null;

            const step = (timestamp) => {
                if (!start) start = timestamp;
                const progress = Math.min((timestamp - start) / duration, 1);

                element.setAttribute('d', interpolator(progress));

                if (progress < 1) {
                    requestAnimationFrame(step);
                } else {
                    resolve();
                }
            };

            requestAnimationFrame(step);
        });
    }

    async blink(duration = 200) {
        const t = duration / 2;
        // Morph to closed
        await Promise.all([
            this.morphElement(this.activeLeftEye, this.eyesLeft.open, this.eyesLeft.closed, t),
            this.morphElement(this.activeRightEye, this.eyesRight.open, this.eyesRight.closed, t)
        ]);
        // Morph back to open
        await Promise.all([
            this.morphElement(this.activeLeftEye, this.eyesLeft.closed, this.eyesLeft.open, t),
            this.morphElement(this.activeRightEye, this.eyesRight.closed, this.eyesRight.open, t)
        ]);
    }

    async setEyesClosed() {
        await Promise.all([
            this.morphElement(this.activeLeftEye, this.activeLeftEye.getAttribute('d'), this.eyesLeft.closed, 300),
            this.morphElement(this.activeRightEye, this.activeRightEye.getAttribute('d'), this.eyesRight.closed, 300)
        ]);
    }

    async setEyesOpen() {
        await Promise.all([
            this.morphElement(this.activeLeftEye, this.activeLeftEye.getAttribute('d'), this.eyesLeft.open, 300),
            this.morphElement(this.activeRightEye, this.activeRightEye.getAttribute('d'), this.eyesRight.open, 300)
        ]);
    }

    async setMouth(shape = 'neutral', duration = 300) {
        const targetD = this.mouths[shape];
        if (!targetD || !this.activeMouth) return;
        await this.morphElement(this.activeMouth, this.activeMouth.getAttribute('d'), targetD, duration);
    }
}
