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
}
