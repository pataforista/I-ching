export function setupAvatarAccessibility(stateMachine) {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleMotionChange = (e) => {
        if (e.matches) {
            stateMachine.destroy();
            // Fallback: avatar becomes entirely static if user prefers reduced motion
        } else {
            // Setup from zero not directly handled here, requires re-init
        }
    };

    // Modern API standard
    reducedMotion.addEventListener('change', handleMotionChange);

    // Initial check on load
    if (reducedMotion.matches) {
        stateMachine.destroy();
    }
}
