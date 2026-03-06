export function initFoxEvents(controller) {
    document.addEventListener('fox_event', (e) => {
        const { eventName } = e.detail;

        const eventMap = {
            'OPEN_SCREEN':       'guide_present',
            'START_SESSION':     'listen',
            'USER_IDLE':         'rest_eyes_closed',
            'USER_TAP_PRIMARY':  'affirm_nod',
            'USER_TAP_SECONDARY':'look_left',
            'SUCCESS':           'happy',
            'ERROR_SOFT':        'blink_soft',
            'SHOW_READING':      'ritual_trace',
            'SHOW_ORACLE':       'ritual_trace',
            'COMPLETE_BREATH':   'guide_present',
            'SLEEP_MODE':        'rest_eyes_closed',
            'WAKE':              'idle_calm',
            // New mappings for expanded UX
            'QUESTION_MODE':     'curious',
            'TOSS_START':        'thinking',
            'TOSS_COMPLETE':     'happy',
            'HISTORY_OPEN':      'sniff',
            'GLOSSARY_OPEN':     'curious',
        };

        const targetState = eventMap[eventName];
        if (targetState) {
            controller.setState(targetState);
        }
    });

    // Interactive Fox: React to clicks directly on the SVG container
    if (controller.container) {
        let lastClick = 0;

        controller.container.style.cursor = 'pointer';
        controller.container.addEventListener('click', (e) => {
            const now = Date.now();
            if (now - lastClick < 900) return; // debounce
            lastClick = now;

            // Haptic feedback
            if (navigator.vibrate) navigator.vibrate([12, 0, 8]);

            // Expanded reactions — weighted pool
            const reactions = [
                'look_left',
                'look_right',
                'blink_soft',
                'affirm_nod',
                'listen',
                'curious',
                'happy',
                'thinking',
                'sniff',
                'look_left',    // extra weight for look interactions
                'look_right',
                'blink_soft',
            ];
            const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
            controller.setState(randomReaction);

            // Dispatch global event so the UI can update the text
            document.dispatchEvent(new CustomEvent('fox_poke'));
        });
    }
}
