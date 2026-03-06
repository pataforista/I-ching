/**
 * ArtBackground — Ukiyo-e / Sumi-e background painting system
 *
 * Sources: MET Museum public domain collection (isPublicDomain: true, CC0)
 * Fallbacks: Procedural SVG ink-wash patterns (offline-safe)
 */

// ─── Curated MET Public Domain Artworks ───────────────────────────────────────
// All images: https://images.metmuseum.org/CRDImages/as/web-large/<file>
// Verified: isPublicDomain === true via MET Open Access API

const MET_BASE = "https://images.metmuseum.org/CRDImages/as/web-large/";
// Smaller images for mobile/slow connections (saves bandwidth, loads faster)
const MET_BASE_SMALL = "https://images.metmuseum.org/CRDImages/as/original/";

/** Returns true if device is likely mobile or on a slow connection */
function _isMobileOrSlow() {
    // Screen width heuristic
    if (window.innerWidth <= 768) return true;
    // Network Information API (Chrome/Android)
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
        // effectiveType: 'slow-2g', '2g', '3g', '4g'
        if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') return true;
        if (conn.saveData === true) return true;
    }
    return false;
}

const MET_ARTWORKS = [
    // Hiroshige — Six Jewel Rivers from Various Provinces (1857, woodblock prints)
    {
        id: "53449-1",
        url: MET_BASE + "DP-13180-023.jpg",
        title: "Six Jewel Rivers",
        artist: "Utagawa Hiroshige",
        year: "1857",
        metUrl: "https://www.metmuseum.org/art/collection/search/53449"
    },
    {
        id: "53449-2",
        url: MET_BASE + "DP-13180-024.jpg",
        title: "Six Jewel Rivers (II)",
        artist: "Utagawa Hiroshige",
        year: "1857",
        metUrl: "https://www.metmuseum.org/art/collection/search/53449"
    },
    {
        id: "53449-3",
        url: MET_BASE + "DP-13180-025.jpg",
        title: "Six Jewel Rivers (III)",
        artist: "Utagawa Hiroshige",
        year: "1857",
        metUrl: "https://www.metmuseum.org/art/collection/search/53449"
    },
    {
        id: "53449-4",
        url: MET_BASE + "DP-13180-026.jpg",
        title: "Six Jewel Rivers (IV)",
        artist: "Utagawa Hiroshige",
        year: "1857",
        metUrl: "https://www.metmuseum.org/art/collection/search/53449"
    },
    {
        id: "53449-5",
        url: MET_BASE + "DP-13180-027.jpg",
        title: "Six Jewel Rivers (V)",
        artist: "Utagawa Hiroshige",
        year: "1857",
        metUrl: "https://www.metmuseum.org/art/collection/search/53449"
    },
    {
        id: "53449-6",
        url: MET_BASE + "DP-13180-028.jpg",
        title: "Six Jewel Rivers (VI)",
        artist: "Utagawa Hiroshige",
        year: "1857",
        metUrl: "https://www.metmuseum.org/art/collection/search/53449"
    },
    // Musō Soseki — Zen Calligraphy hanging scroll (early 14th century, ink on paper)
    {
        id: "816189",
        url: MET_BASE + "DP-17101-002.jpg",
        title: "Abiding nowhere, the awakened mind arises",
        artist: "Musō Soseki",
        year: "early 14th century",
        metUrl: "https://www.metmuseum.org/art/collection/search/816189"
    },
    // Anonymous Kamakura — Ten Verses on Oxherding (1278, ink on paper)
    {
        id: "53660",
        url: MET_BASE + "2015_300_10_Burke_website.jpg",
        title: "Ten Verses on Oxherding",
        artist: "Anonymous (Kamakura period)",
        year: "1278",
        metUrl: "https://www.metmuseum.org/art/collection/search/53660"
    },
    // Han Gan — Night-Shining White (ca. 750, ink on paper) — Tang dynasty masterpiece
    {
        id: "39901",
        url: MET_BASE + "DP153705.jpg",
        title: "Night-Shining White",
        artist: "Han Gan",
        year: "ca. 750",
        metUrl: "https://www.metmuseum.org/art/collection/search/39901"
    }
];

// ─── Local SVG Fallbacks (offline-safe, no network needed) ────────────────────
const FALLBACK_SVGS = [
    "./assets/fallback/sumi-mountains.svg",
    "./assets/fallback/sumi-bamboo.svg",
    "./assets/fallback/sumi-waves.svg",
    "./assets/fallback/sumi-moon.svg",
    "./assets/fallback/sumi-reeds.svg"
];

const LOAD_TIMEOUT_MS = 7000;       // 7s on desktop
const LOAD_TIMEOUT_MOBILE_MS = 5000; // 5s on mobile/slow connections

// ─── ArtBackground Class ──────────────────────────────────────────────────────
export class ArtBackground {
    constructor() {
        this._layer = null;
        this._imgA = null;
        this._imgB = null;
        this._attr = null;
        this._overlay = null;
        this._active = "A"; // which img buffer is visible
        this._usedIds = new Set();
        this._currentArtwork = null;
        this._isTransitioning = false;
    }

    /** Initialize DOM and load first artwork */
    init() {
        this._buildDOM();
        this._loadNext();
    }

    /** Called on every navigation — crossfades to a new artwork */
    transition() {
        if (this._isTransitioning) return;
        // Small delay so the ink transition overlay is visible first
        setTimeout(() => this._loadNext(), 500);
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    _buildDOM() {
        // Main layer (behind everything)
        const layer = document.createElement("div");
        layer.id = "art-bg-layer";

        const imgA = document.createElement("img");
        imgA.id = "art-bg-img-a";
        imgA.alt = "";
        imgA.setAttribute("role", "presentation");
        imgA.setAttribute("aria-hidden", "true");

        const imgB = document.createElement("img");
        imgB.id = "art-bg-img-b";
        imgB.alt = "";
        imgB.setAttribute("role", "presentation");
        imgB.setAttribute("aria-hidden", "true");

        layer.appendChild(imgA);
        layer.appendChild(imgB);

        // Semi-transparent paper overlay (keeps UI readable)
        const overlay = document.createElement("div");
        overlay.id = "art-bg-overlay";
        overlay.setAttribute("aria-hidden", "true");

        // Attribution badge
        const attr = document.createElement("div");
        attr.id = "art-bg-attr";
        attr.setAttribute("aria-hidden", "true");

        // Insert into DOM — before everything else
        const body = document.body;
        body.insertBefore(attr, body.firstChild);
        body.insertBefore(overlay, body.firstChild);
        body.insertBefore(layer, body.firstChild);

        this._layer = layer;
        this._imgA = imgA;
        this._imgB = imgB;
        this._attr = attr;
        this._overlay = overlay;
    }

    /** Pick next artwork (avoid repeats, cycle through) */
    _pickArtwork() {
        let available = MET_ARTWORKS.filter(a => !this._usedIds.has(a.id));
        if (available.length === 0) {
            this._usedIds.clear();
            available = [...MET_ARTWORKS];
        }
        const pick = available[Math.floor(Math.random() * available.length)];
        this._usedIds.add(pick.id);
        return pick;
    }

    _pickFallback() {
        return FALLBACK_SVGS[Math.floor(Math.random() * FALLBACK_SVGS.length)];
    }

    async _loadNext() {
        this._isTransitioning = true;
        const artwork = this._pickArtwork();
        const mobile = _isMobileOrSlow();
        const timeout = mobile ? LOAD_TIMEOUT_MOBILE_MS : LOAD_TIMEOUT_MS;

        try {
            const src = await this._loadWithTimeout(artwork.url, timeout);
            this._crossfade(src);
            this._setAttribution(artwork);
        } catch {
            // Network failed or timed out — use local SVG fallback
            const fallbackSrc = this._pickFallback();
            this._crossfade(fallbackSrc);
            this._clearAttribution();
        } finally {
            this._isTransitioning = false;
        }
    }

    /** Load an image, reject after timeout or on error */
    _loadWithTimeout(url, timeoutMs) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const timer = setTimeout(() => {
                img.src = ""; // abort
                reject(new Error("timeout"));
            }, timeoutMs);

            img.onload = () => {
                clearTimeout(timer);
                resolve(url);
            };
            img.onerror = () => {
                clearTimeout(timer);
                reject(new Error("load error"));
            };
            img.src = url;
        });
    }

    /** Crossfade between the two image buffers (A/B) */
    _crossfade(src) {
        const incoming = this._active === "A" ? this._imgB : this._imgA;
        const outgoing = this._active === "A" ? this._imgA : this._imgB;

        incoming.onload = () => {
            // Show incoming, hide outgoing
            incoming.style.opacity = "1";
            incoming.style.zIndex = "2";
            outgoing.style.opacity = "0";
            outgoing.style.zIndex = "1";
            this._active = this._active === "A" ? "B" : "A";
        };
        incoming.src = src;
    }

    _setAttribution({ title, artist, year, metUrl }) {
        if (this._attr) {
            this._attr.innerHTML = `
        <a href="${metUrl}" target="_blank" rel="noopener noreferrer"
           style="color:inherit; text-decoration:none; cursor:default; pointer-events:auto;"
           title="Ver en The Metropolitan Museum of Art">
          ${title} · ${artist} · ${year} · MET Open Access
        </a>`;
        }
    }

    _clearAttribution() {
        if (this._attr) this._attr.textContent = "";
    }
}
