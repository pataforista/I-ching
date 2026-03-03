export const FoxTheme = {
    // Colors for styling references if needed
    colors: {
        base: 'hsl(14, 75%, 48%)',
        shadow: 'hsl(240, 6%, 12%)',
        innerEar: 'hsl(15, 30%, 75%)',
        lines: 'hsl(240, 6%, 20%)',
        halo: 'hsl(156, 30%, 42%)',
    },
    // Animation Durations in ms
    timing: {
        breathTorso: 5400, // Slower (was 4800)
        breathHead: 5400,  // Slower
        tailSway: 6800,    // Slightly livelier while calm
        blinkBase: 200, // 180-260ms
        nodBase: 500, // 420-650ms
        lookBase: 400, // 300-500ms
        ritualTrace: 1200 // 900-1600ms
    },
    // Animation Amplitudes
    amplitudes: {
        headY: 1.8,
        torsoY: 2.3,
        tailRot: 2.8,
        nodRot: 6,
        lookX: 1.5
    }
};
