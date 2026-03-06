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
    <!-- Halo gradients -->
    <radialGradient id="fox-halo-grad" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="hsl(156, 45%, 55%)" stop-opacity="0.08" />
      <stop offset="60%"  stop-color="hsl(180, 40%, 50%)" stop-opacity="0.12" />
      <stop offset="100%" stop-color="hsl(220, 35%, 45%)" stop-opacity="0.04" />
    </radialGradient>
    <linearGradient id="fox-halo-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="hsl(156, 45%, 55%)" stop-opacity="0.55" />
      <stop offset="50%"  stop-color="hsl(200, 40%, 60%)" stop-opacity="0.35" />
      <stop offset="100%" stop-color="hsl(260, 35%, 55%)" stop-opacity="0.20" />
    </linearGradient>

    <!-- Body / coat gradients -->
    <linearGradient id="fox-body-grad" x1="0%" y1="0%" x2="10%" y2="100%">
      <stop offset="0%"   stop-color="hsl(16, 82%, 55%)" />
      <stop offset="40%"  stop-color="hsl(14, 75%, 48%)" />
      <stop offset="75%"  stop-color="hsl(13, 70%, 42%)" />
      <stop offset="100%" stop-color="hsl(12, 65%, 30%)" />
    </linearGradient>
    <radialGradient id="fox-body-sheen" cx="35%" cy="20%" r="55%">
      <stop offset="0%"   stop-color="hsl(20, 90%, 75%)" stop-opacity="0.18" />
      <stop offset="100%" stop-color="hsl(14, 75%, 48%)" stop-opacity="0" />
    </radialGradient>

    <!-- Head -->
    <radialGradient id="fox-head-grad" cx="38%" cy="26%" r="72%">
      <stop offset="0%"   stop-color="hsl(18, 88%, 62%)" />
      <stop offset="50%"  stop-color="hsl(15, 78%, 50%)" />
      <stop offset="100%" stop-color="hsl(13, 68%, 34%)" />
    </radialGradient>
    <radialGradient id="fox-head-sheen" cx="30%" cy="15%" r="45%">
      <stop offset="0%"   stop-color="hsl(25, 100%, 80%)" stop-opacity="0.20" />
      <stop offset="100%" stop-color="hsl(15, 78%, 50%)"  stop-opacity="0" />
    </radialGradient>

    <!-- Chest / belly -->
    <linearGradient id="fox-chest-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="hsl(34, 28%, 97%)" stop-opacity="0.98" />
      <stop offset="60%"  stop-color="hsl(30, 22%, 92%)" stop-opacity="0.80" />
      <stop offset="100%" stop-color="hsl(28, 18%, 84%)" stop-opacity="0.55" />
    </linearGradient>

    <!-- Tail -->
    <linearGradient id="fox-tail-grad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="hsl(12, 65%, 30%)" />
      <stop offset="30%"  stop-color="hsl(14, 75%, 45%)" />
      <stop offset="65%"  stop-color="hsl(38, 90%, 52%)" />
      <stop offset="85%"  stop-color="hsl(42, 95%, 60%)" />
      <stop offset="100%" stop-color="hsl(45, 100%, 72%)" />
    </linearGradient>
    <linearGradient id="fox-tail-tip-grad" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%"   stop-color="hsl(38, 30%, 82%)" />
      <stop offset="100%" stop-color="hsl(34, 20%, 96%)" />
    </linearGradient>
    <radialGradient id="fox-tail-sheen" cx="60%" cy="20%" r="60%">
      <stop offset="0%"   stop-color="hsl(45, 100%, 85%)" stop-opacity="0.22" />
      <stop offset="100%" stop-color="hsl(42, 90%, 55%)"  stop-opacity="0" />
    </radialGradient>

    <!-- Iris / eye -->
    <radialGradient id="fox-iris-left" cx="38%" cy="32%" r="65%">
      <stop offset="0%"   stop-color="hsl(38, 90%, 60%)" />
      <stop offset="50%"  stop-color="hsl(28, 80%, 40%)" />
      <stop offset="100%" stop-color="hsl(22, 65%, 22%)" />
    </radialGradient>
    <radialGradient id="fox-iris-right" cx="62%" cy="32%" r="65%">
      <stop offset="0%"   stop-color="hsl(38, 90%, 60%)" />
      <stop offset="50%"  stop-color="hsl(28, 80%, 40%)" />
      <stop offset="100%" stop-color="hsl(22, 65%, 22%)" />
    </radialGradient>

    <!-- Cheek blush -->
    <radialGradient id="fox-cheek-grad" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="hsl(0, 90%, 72%)" stop-opacity="0.52" />
      <stop offset="100%" stop-color="hsl(340, 88%, 72%)" stop-opacity="0" />
    </radialGradient>

    <!-- Nose -->
    <radialGradient id="fox-nose-grad" cx="40%" cy="35%" r="65%">
      <stop offset="0%"   stop-color="hsl(245, 12%, 35%)" />
      <stop offset="100%" stop-color="hsl(240, 8%, 16%)" />
    </radialGradient>

    <!-- Inner ear -->
    <linearGradient id="fox-inner-ear-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="hsl(345, 55%, 78%)" />
      <stop offset="100%" stop-color="hsl(15, 40%, 82%)" />
    </linearGradient>

    <!-- Paw -->
    <radialGradient id="fox-paw-grad" cx="50%" cy="30%" r="60%">
      <stop offset="0%"   stop-color="hsl(16, 75%, 52%)" />
      <stop offset="100%" stop-color="hsl(13, 65%, 36%)" />
    </radialGradient>

    <!-- Filters -->
    <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="hsl(12, 50%, 12%)" flood-opacity="0.10"/>
    </filter>
    <filter id="glow-jade" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="fur-texture" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9 0.6" numOctaves="3" seed="7" result="noise"/>
      <feColorMatrix type="saturate" values="0" in="noise" result="grey"/>
      <feBlend in="SourceGraphic" in2="grey" mode="multiply" result="blend"/>
      <feComposite in="blend" in2="SourceGraphic" operator="in"/>
    </filter>
  </defs>

  <!-- Halo / Ensō — iridescent ring -->
  <g id="fox-halo" transform="translate(200, 178)" style="transform-origin: 0px 0px;">
    <circle cx="0" cy="0" r="142" fill="url(#fox-halo-grad)" />
    <circle cx="0" cy="0" r="142" fill="none"
      stroke="url(#fox-halo-stroke)" stroke-width="1.8" stroke-opacity="0.55"
      stroke-dasharray="893" stroke-dashoffset="0"
      stroke-linecap="round" />
    <!-- Tiny sparkle dots on the ring -->
    <circle cx="100"  cy="-100" r="1.4" fill="hsl(156,50%,65%)" opacity="0.55" />
    <circle cx="-120" cy="-70"  r="1.0" fill="hsl(200,55%,68%)" opacity="0.40" />
    <circle cx="60"   cy="130"  r="0.9" fill="hsl(260,45%,65%)" opacity="0.35" />
  </g>

  <!-- Ground shadow — softened -->
  <ellipse id="fox-shadow" cx="200" cy="344" rx="108" ry="13"
    fill="hsl(240, 8%, 10%)" opacity="0.07" />

  <!-- Fox character root -->
  <g id="fox-character" transform="translate(200, 240)">

    <!-- ═══════════ TAIL ═══════════ -->
    <g id="fox-tail-base" style="transform-origin: -38px 58px;">
      <!-- Main tail shape with rich gradient -->
      <path d="M 42,82 C 145,92 185,18 122,-22 C 80,-52 18,-32 -22,8 C -52,42 -42,72 42,82 Z"
        fill="url(#fox-tail-grad)" filter="url(#soft-shadow)" />
      <!-- Sheen highlight -->
      <path d="M 42,82 C 145,92 185,18 122,-22 C 80,-52 18,-32 -22,8 C -52,42 -42,72 42,82 Z"
        fill="url(#fox-tail-sheen)" />
      <!-- Subtle fur stroke lines -->
      <path d="M -10,60 Q 40,40 100,10" fill="none" stroke="hsl(38,80%,60%)" stroke-width="0.6" stroke-opacity="0.3" stroke-linecap="round"/>
      <path d="M 20,75 Q 80,55 140,25" fill="none" stroke="hsl(38,80%,60%)" stroke-width="0.5" stroke-opacity="0.25" stroke-linecap="round"/>
    </g>

    <!-- Tail tip -->
    <g id="fox-tail-tip" transform="translate(122, -22)">
      <path d="M 0,0 C -14,-22 8,-36 22,-14 C 24,8 6,12 0,0 Z" fill="url(#fox-tail-tip-grad)" />
      <!-- Tip highlight -->
      <ellipse cx="10" cy="-6" rx="5" ry="3" fill="white" opacity="0.22" transform="rotate(-20,10,-6)"/>
    </g>

    <!-- ═══════════ BODY ═══════════ -->
    <g id="fox-body" style="transform-origin: 0px 40px;">
      <!-- Main body shape -->
      <path d="M -52,82 C -62,0 -42,-62 0,-82 C 42,-62 62,0 52,82 Z"
        fill="url(#fox-body-grad)" filter="url(#soft-shadow)"/>
      <!-- Body sheen -->
      <path d="M -52,82 C -62,0 -42,-62 0,-82 C 42,-62 62,0 52,82 Z"
        fill="url(#fox-body-sheen)" />
      <!-- Chest / belly ruff -->
      <path d="M -27,78 C -32,42 -22,2 0,-16 C 22,2 32,42 27,78 Z"
        fill="url(#fox-chest-grad)" opacity="0.88" />
      <!-- Subtle flank fur strokes -->
      <path d="M -48,20 Q -35,-10 -15,-40" fill="none" stroke="hsl(16,70%,42%)" stroke-width="0.7" stroke-opacity="0.20" stroke-linecap="round"/>
      <path d="M 48,20 Q 35,-10 15,-40"  fill="none" stroke="hsl(16,70%,42%)" stroke-width="0.7" stroke-opacity="0.20" stroke-linecap="round"/>
    </g>

    <!-- Neck / Ruff collar -->
    <g id="fox-neck" transform="translate(0, -72)">
      <path d="M -37,10 C -48,32 48,32 37,10 C 20,22 -20,22 -37,10 Z"
        fill="hsl(34, 22%, 97%)" opacity="0.90" />
    </g>

    <!-- ═══════════ FRONT PAWS ═══════════ -->
    <g id="fox-paws" transform="translate(0, 76)" opacity="0.90">
      <!-- Left paw -->
      <g id="fox-paw-left" transform="translate(-28, 0)">
        <ellipse cx="0" cy="0" rx="16" ry="10" fill="url(#fox-paw-grad)" />
        <!-- Toe lines -->
        <path d="M -8,-2 Q -8,4 -8,8"  fill="none" stroke="hsl(13,55%,28%)" stroke-width="0.9" stroke-opacity="0.35" stroke-linecap="round"/>
        <path d="M 0,-3  Q 0,4  0,8"   fill="none" stroke="hsl(13,55%,28%)" stroke-width="0.9" stroke-opacity="0.35" stroke-linecap="round"/>
        <path d="M 8,-2  Q 8,4  8,8"   fill="none" stroke="hsl(13,55%,28%)" stroke-width="0.9" stroke-opacity="0.35" stroke-linecap="round"/>
      </g>
      <!-- Right paw -->
      <g id="fox-paw-right" transform="translate(28, 0)">
        <ellipse cx="0" cy="0" rx="16" ry="10" fill="url(#fox-paw-grad)" />
        <path d="M -8,-2 Q -8,4 -8,8"  fill="none" stroke="hsl(13,55%,28%)" stroke-width="0.9" stroke-opacity="0.35" stroke-linecap="round"/>
        <path d="M 0,-3  Q 0,4  0,8"   fill="none" stroke="hsl(13,55%,28%)" stroke-width="0.9" stroke-opacity="0.35" stroke-linecap="round"/>
        <path d="M 8,-2  Q 8,4  8,8"   fill="none" stroke="hsl(13,55%,28%)" stroke-width="0.9" stroke-opacity="0.35" stroke-linecap="round"/>
      </g>
    </g>

    <!-- Zen Necklace Beads -->
    <g id="fox-necklace" transform="translate(0, -68)" opacity="0.82">
      <!-- String arc -->
      <path d="M -14,14 Q 0,22 14,14" fill="none" stroke="hsl(38, 25%, 28%)" stroke-width="0.8" />
      <!-- Center bead -->
      <circle cx="0" cy="19" r="4.8" fill="hsl(38, 55%, 46%)" />
      <circle cx="-1.2" cy="18" r="1.4" fill="white" opacity="0.28" />
      <!-- Side beads -->
      <circle cx="-10" cy="15" r="3.2" fill="hsl(38, 48%, 52%)" />
      <circle cx="10"  cy="15" r="3.2" fill="hsl(38, 48%, 52%)" />
    </g>

    <!-- ═══════════ HEAD GROUP ═══════════ -->
    <g id="fox-head" style="transform-origin: 0px -82px;" transform="translate(0, -82)">

      <!-- ── Ears ── -->
      <g id="fox-ear-left" style="transform-origin: -26px -28px;">
        <!-- Outer ear -->
        <path d="M -16,-24 C -32,-52 -48,-64 -46,-30 C -46,-14 -36,-8 -26,2 Z"
          fill="hsl(14, 70%, 44%)" />
        <!-- Ear spikes / tuft tips -->
        <path d="M -38,-50 L -44,-60 L -50,-48 Z" fill="hsl(14, 68%, 40%)" />
        <path d="M -32,-56 L -36,-66 L -42,-56 Z" fill="hsl(14, 68%, 40%)" />
        <!-- Inner ear -->
        <path d="M -22,-21 C -33,-44 -40,-50 -40,-30 C -40,-18 -32,-12 -26,-3 Z"
          fill="url(#fox-inner-ear-grad)" opacity="0.85" />
        <!-- Inner highlight -->
        <path d="M -26,-20 C -32,-35 -36,-40 -36,-28" fill="none" stroke="hsl(345,60%,90%)" stroke-width="0.8" stroke-opacity="0.40" stroke-linecap="round"/>
      </g>
      <g id="fox-ear-right" style="transform-origin: 26px -28px;">
        <path d="M 16,-24 C 32,-52 48,-64 46,-30 C 46,-14 36,-8 26,2 Z"
          fill="hsl(14, 70%, 44%)" />
        <path d="M 38,-50 L 44,-60 L 50,-48 Z" fill="hsl(14, 68%, 40%)" />
        <path d="M 32,-56 L 36,-66 L 42,-56 Z" fill="hsl(14, 68%, 40%)" />
        <path d="M 22,-21 C 33,-44 40,-50 40,-30 C 40,-18 32,-12 26,-3 Z"
          fill="url(#fox-inner-ear-grad)" opacity="0.85" />
        <path d="M 26,-20 C 32,-35 36,-40 36,-28" fill="none" stroke="hsl(345,60%,90%)" stroke-width="0.8" stroke-opacity="0.40" stroke-linecap="round"/>
      </g>

      <!-- ── Head Base ── -->
      <path d="M -42,-8 C -52,22 0,42 42,-8 C 62,-40 20,-62 0,-62 C -20,-62 -62,-40 -42,-8 Z"
        fill="url(#fox-head-grad)" filter="url(#soft-shadow)"/>
      <!-- Head sheen -->
      <path d="M -42,-8 C -52,22 0,42 42,-8 C 62,-40 20,-62 0,-62 C -20,-62 -62,-40 -42,-8 Z"
        fill="url(#fox-head-sheen)" />

      <!-- ── Forehead fur stripe ── -->
      <path d="M 0,-58 Q 0,-42 0,-24" fill="none" stroke="hsl(18,75%,55%)" stroke-width="1.8" stroke-opacity="0.18" stroke-linecap="round"/>

      <!-- ── Cheek Blush ── -->
      <g id="fox-cheeks" opacity="0.92">
        <ellipse cx="-30" cy="11" rx="10" ry="5.5" fill="url(#fox-cheek-grad)" />
        <ellipse cx="30"  cy="11" rx="10" ry="5.5" fill="url(#fox-cheek-grad)" />
      </g>

      <!-- ── Muzzle ── -->
      <g id="fox-muzzle">
        <path d="M -16,10 C -16,32 16,32 16,10 C 6,4 -6,4 -16,10 Z"
          fill="hsl(34, 22%, 97%)" opacity="0.96" />
        <!-- Nose — cuter rounded shape -->
        <path id="fox-nose" d="M -5,21 C -6,18 -4,16 0,16 C 4,16 6,18 5,21 C 4,24 -4,24 -5,21 Z"
          fill="url(#fox-nose-grad)" />
        <!-- Nose highlight -->
        <ellipse cx="-1.5" cy="18.5" rx="1.8" ry="1.0" fill="white" opacity="0.30" />
        <!-- Philtrum line -->
        <path d="M 0,22 L 0,27" fill="none" stroke="hsl(240,8%,26%)" stroke-width="0.9" stroke-linecap="round" stroke-opacity="0.40"/>
      </g>

      <!-- ── Whiskers — three rows per side ── -->
      <g id="fox-whiskers" opacity="0.50">
        <!-- Left side — upper, mid, lower -->
        <path d="M -16,16 Q -30,14 -40,10" fill="none" stroke="hsl(240,6%,88%)" stroke-width="1.1" stroke-linecap="round"/>
        <path d="M -16,19 Q -30,18 -42,16" fill="none" stroke="hsl(240,6%,88%)" stroke-width="1.0" stroke-linecap="round"/>
        <path d="M -16,22 Q -28,23 -38,22" fill="none" stroke="hsl(240,6%,88%)" stroke-width="0.9" stroke-linecap="round"/>
        <!-- Right side -->
        <path d="M 16,16 Q 30,14 40,10" fill="none" stroke="hsl(240,6%,88%)" stroke-width="1.1" stroke-linecap="round"/>
        <path d="M 16,19 Q 30,18 42,16" fill="none" stroke="hsl(240,6%,88%)" stroke-width="1.0" stroke-linecap="round"/>
        <path d="M 16,22 Q 28,23 38,22" fill="none" stroke="hsl(240,6%,88%)" stroke-width="0.9" stroke-linecap="round"/>
      </g>

      <!-- ── Mouth Morphs ── -->
      <g id="fox-mouth">
        <path id="fox-mouth-neutral"
          d="M -6,29 Q 0,31 6,29"
          fill="none" stroke="hsl(240, 8%, 28%)" stroke-width="1.3" stroke-linecap="round" />
        <path id="fox-mouth-soft"
          d="M -8,28 Q -3,33 0,29 Q 3,33 8,28"
          fill="none" stroke="hsl(240, 8%, 28%)" stroke-width="1.3" stroke-linecap="round"
          style="display:none;" />
        <path id="fox-mouth-open"
          d="M -7,28 Q 0,36 7,28"
          fill="none" stroke="hsl(240, 8%, 28%)" stroke-width="1.3" stroke-linecap="round"
          style="display:none;" />
      </g>

      <!-- ── Eyes (Left) — with iris and pupil ── -->
      <g id="fox-eye-left">
        <!-- Eye socket / whites hint -->
        <ellipse cx="-16" cy="-3" rx="7.5" ry="5.5" fill="hsl(30,20%,95%)" opacity="0.25"/>
        <!-- Iris -->
        <ellipse id="fox-iris-left" cx="-16" cy="-3" rx="5.5" ry="4.5" fill="url(#fox-iris-left)" />
        <!-- Pupil -->
        <ellipse id="fox-pupil-left" cx="-16" cy="-3" rx="2.8" ry="3.2" fill="hsl(240,8%,8%)" />
        <!-- Eye outline morph path (shape layer) -->
        <path id="fox-eye-left-open"
          d="M -23,-3 Q -16,-10 -9,-3 Q -16,3 -23,-3 Z"
          fill="hsl(240, 8%, 10%)" opacity="0" />
        <!-- Glints -->
        <circle id="fox-glint-left-1" cx="-19" cy="-5" r="1.8" fill="white" opacity="0.90" />
        <circle id="fox-glint-left-2" cx="-13" cy="-4" r="1.0" fill="white" opacity="0.50" />
        <!-- Half / closed morph shapes (hidden, data only) -->
        <path id="fox-eye-left-half"   d="M -23,-3 Q -16,-5 -9,-3 Q -16,-1 -23,-3 Z" fill="hsl(240,8%,14%)" style="display:none;" />
        <path id="fox-eye-left-closed" d="M -23,-3 Q -16,0 -9,-3" fill="none" stroke="hsl(240,8%,18%)" stroke-width="2.5" stroke-linecap="round" style="display:none;" />
        <!-- Eyelid overlay (used for blink clip) — drawn last so it covers iris -->
        <path id="fox-lid-left"
          d="M -23,-3 Q -16,-10 -9,-3 Q -16,3 -23,-3 Z"
          fill="url(#fox-head-grad)" opacity="0"
          pointer-events="none" />
      </g>

      <!-- ── Eyes (Right) ── -->
      <g id="fox-eye-right">
        <ellipse cx="16" cy="-3" rx="7.5" ry="5.5" fill="hsl(30,20%,95%)" opacity="0.25"/>
        <ellipse id="fox-iris-right" cx="16" cy="-3" rx="5.5" ry="4.5" fill="url(#fox-iris-right)" />
        <ellipse id="fox-pupil-right" cx="16" cy="-3" rx="2.8" ry="3.2" fill="hsl(240,8%,8%)" />
        <path id="fox-eye-right-open"
          d="M 9,-3 Q 16,-10 23,-3 Q 16,3 9,-3 Z"
          fill="hsl(240, 8%, 10%)" opacity="0" />
        <circle id="fox-glint-right-1" cx="13" cy="-5" r="1.8" fill="white" opacity="0.90" />
        <circle id="fox-glint-right-2" cx="19" cy="-4" r="1.0" fill="white" opacity="0.50" />
        <path id="fox-eye-right-half"   d="M 9,-3 Q 16,-5 23,-3 Q 16,-1 9,-3 Z" fill="hsl(240,8%,14%)" style="display:none;" />
        <path id="fox-eye-right-closed" d="M 9,-3 Q 16,0 23,-3" fill="none" stroke="hsl(240,8%,18%)" stroke-width="2.5" stroke-linecap="round" style="display:none;" />
        <path id="fox-lid-right"
          d="M 9,-3 Q 16,-10 23,-3 Q 16,3 9,-3 Z"
          fill="url(#fox-head-grad)" opacity="0"
          pointer-events="none" />
      </g>

      <!-- ── Brows — expressible ── -->
      <g id="fox-brow-left">
        <path id="fox-brow-left-path"
          d="M -24,-14 Q -16,-18 -9,-12"
          fill="none" stroke="hsl(13, 55%, 32%)" stroke-width="1.5" stroke-linecap="round" />
      </g>
      <g id="fox-brow-right">
        <path id="fox-brow-right-path"
          d="M 9,-12 Q 16,-18 24,-14"
          fill="none" stroke="hsl(13, 55%, 32%)" stroke-width="1.5" stroke-linecap="round" />
      </g>

      <!-- ── Zen bead head accessory ── -->
      <g id="fox-accessory" transform="translate(0, -38)">
        <circle cx="0" cy="0" r="3.2" fill="hsl(38, 35%, 62%)" opacity="0.65"/>
        <circle cx="-1" cy="-1" r="1.0" fill="white" opacity="0.25"/>
      </g>

    </g><!-- /fox-head -->
  </g><!-- /fox-character -->
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
