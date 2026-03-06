export function initFoxEvents(controller) {
    document.addEventListener('fox_event', (e) => {
        const { eventName } = e.detail;

        const eventMap = {
            'OPEN_SCREEN': 'guide_present',
            'START_SESSION': 'listen',
            'USER_IDLE': 'rest_eyes_closed',
            'USER_TAP_PRIMARY': 'affirm_nod',
            'USER_TAP_SECONDARY': 'look_left',
            'SUCCESS': 'affirm_nod',
            'ERROR_SOFT': 'blink_soft',
            'SHOW_READING': 'ritual_trace',
            'SHOW_ORACLE': 'ritual_trace',
            'COMPLETE_BREATH': 'guide_present',
            'SLEEP_MODE': 'rest_eyes_closed',
            'WAKE': 'idle_calm'
        };
        const targetState = eventMap[eventName];
        if (targetState) {
            controller.setState(targetState);
        }
    });

    // Interactive Fox: React to clicks directly on the SVG container
    if (controller.container) {
        // Prevent double triggers on touch
        let lastClick = 0;

        controller.container.style.cursor = 'pointer';
        controller.container.addEventListener('click', (e) => {
            const now = Date.now();
            if (now - lastClick < 1000) return; // debounce
            lastClick = now;

            // Trigger haptic feedback
            if (navigator.vibrate) navigator.vibrate(15);

            // Randomly choose a reaction state
            const reactions = ['look_left', 'blink_soft', 'affirm_nod', 'ritual_trace'];
            const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
            controller.setState(randomReaction);

            // Dispatch global event so the UI can update the text
            document.dispatchEvent(new CustomEvent('fox_poke'));
        });
    }
}
