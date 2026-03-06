export const FoxTheme = {
    // Colors for styling references if needed
    colors: {
        base:     'hsl(14, 75%, 48%)',
        shadow:   'hsl(240, 6%, 12%)',
        innerEar: 'hsl(345, 55%, 78%)',
        lines:    'hsl(240, 6%, 20%)',
        halo:     'hsl(156, 45%, 55%)',
        iris:     'hsl(38, 90%, 60%)',
    },
    // Animation Durations in ms
    timing: {
        breathTorso:  5400,  // 5.4s — slow, meditative
        breathHead:   5200,  // Slightly out of phase with torso
        tailSway:     6600,  // Livelier asymmetric sway
        blinkBase:    200,   // 180-260ms randomized
        nodBase:      500,   // 420-650ms randomized
        lookBase:     420,   // 320-520ms randomized
        ritualTrace:  1400,  // Halo stroke draw
        bounceBase:   560,
        sniffBase:    700,
        lookUpBase:   950,
        shakeBase:    550,
        tailFlick:    420,
        stretchBase:  1100,
        floatBase:    1800,
    },
    // Animation Amplitudes
    amplitudes: {
        headY:    1.8,
        torsoY:   2.4,
        tailRot:  3.0,   // Slightly more expressive
        nodRot:   6,
        lookX:    2.0,   // A bit more expressive
        bounceY:  12,
        sniffY:   5,
        lookUpY:  4,
    }
};
