// ====== BOMISU.PL — WSPÓLNY SILNIK TŁA, KSIĘŻYCA I NAWIGACJI ======
// Ładowany na każdej podstronie. Dzięki temu przeglądarka cache'uje ten kod
// i nie parsuje go ponownie przy każdej zmianie strony.
(function () {
  'use strict';

  // ====== POMOCNICZE ======
  const storage = {
    get(key) {
      try { return window.sessionStorage.getItem(key); } catch (err) { return null; }
    },
    set(key, value) {
      try { window.sessionStorage.setItem(key, String(value)); } catch (err) { /* brak dostępu */ }
    },
    remove(key) {
      try { window.sessionStorage.removeItem(key); } catch (err) { /* brak dostępu */ }
    }
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const toNumber = (value, fallback) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const nowMs = () => Date.now();
  const TAU = Math.PI * 2;
  const lowPower = !!(
    (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
  );

  // Skala interfejsu ustawiana przez skrypt w <head> (Full HD = 1).
  const readUiScale = () => {
    const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-scale'));
    return Number.isFinite(value) && value > 0 ? value : 1;
  };
  let uiScale = readUiScale();

  if (lowPower) document.documentElement.classList.add('low-power');

  // Czas startu całej sesji — wspólny dla gwiazd i animacji tła.
  if (!storage.get('starTime')) storage.set('starTime', nowMs());
  const starTime = toNumber(storage.get('starTime'), nowMs());

  // ====== STAN WSPÓLNY ======
  let posX = 0;
  let posY = 0;
  let velX = 0;
  let velY = 0;
  let idleStart = 0;
  let moonSize = 180;
  let physicsRunning = false;
  let lastPhysicsTs = 0;
  let lastCanvasDraw = 0;
  let isDragging = false;
  let isNavigating = false;

  // ====== NAWIGACJA ======
  const pageName = path => (path.split('/').pop() || 'index').replace(/\.html$/, '');

  // Przybliżony ping: RTT z Network Information API albo czas odpowiedzi
  // serwera zmierzony przy ładowaniu bieżącej strony.
  function estimateRtt() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    let rtt = conn && Number.isFinite(conn.rtt) ? conn.rtt : 0;

    if (window.performance && performance.getEntriesByType) {
      const nav = performance.getEntriesByType('navigation')[0];
      if (nav && nav.requestStart > 0) {
        const ttfb = nav.responseStart - nav.requestStart;
        if (ttfb > 0) rtt = Math.max(rtt, ttfb);
      }
    }

    return Math.max(0, Math.min(rtt, 1500));
  }

  // Czy docelowa strona została już pobrana przez <link rel="prefetch">.
  // Jeśli tak, jej otwarcie jest natychmiastowe i można spokojnie dograć
  // całą animację wyjścia.
  function isPrefetched(url) {
    if (!window.performance || !performance.getEntriesByType) return false;
    try {
      const target = new URL(url, location.href).href;
      return performance.getEntriesByType('resource').some(entry =>
        entry.name === target && entry.responseEnd > 0
      );
    } catch (err) {
      return false;
    }
  }

  function saveState() {
    storage.set('moonX', posX.toFixed(2));
    storage.set('moonY', posY.toFixed(2));
    storage.set('moonUiScale', uiScale.toFixed(4));
    storage.set('moonVelX', velX.toFixed(4));
    storage.set('moonVelY', velY.toFixed(4));
    storage.set('moonSaveTime', nowMs());
    storage.set('moonIdleStart', idleStart || 0);
    saveShootingStars();
  }

  function navigateTo(url) {
    if (isNavigating || pageName(url) === pageName(location.pathname)) return;
    isNavigating = true;
    saveState();
    document.body.classList.add('page-exit');

    // Normalnie czekamy na koniec animacji wyjścia. Jeśli docelowa strona
    // nie jest jeszcze pobrana, zaczynamy ładowanie wcześniej o zmierzony
    // ping — animacja przykrywa wtedy opóźnienie sieci.
    const baseDelay = 580;
    const minDelay = 280;
    const rtt = estimateRtt();
    const delay = isPrefetched(url) ? baseDelay : Math.max(minDelay, baseDelay - rtt);

    window.setTimeout(() => {
      // Zapisujemy dokładnie tę klatkę, którą użytkownik widzi tuż przed wyjściem.
      saveStarSnapshot();
      window.location.href = url;
    }, delay);
  }
  window.navigateTo = navigateTo;

  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      isNavigating = false;
      document.body.classList.remove('page-exit');
      lastPhysicsTs = 0;
      lastCanvasDraw = 0;
      syncShotVisuals();
    }
  });

  window.addEventListener('pagehide', () => {
    saveState();
    // Także przy nawigacji przeglądarki (wstecz/dalej) zapisujemy obraz tła.
    saveStarSnapshot();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      saveState();
    } else {
      lastPhysicsTs = 0;
      lastCanvasDraw = 0;
      syncShotVisuals();
    }
  });

  // ====== KSIĘŻYC ======
  const moon = document.getElementById('moon');

  if (moon) {
    const moonImg = moon.querySelector('.moon-img');
    const FRICTION = 0.995;
    const BOUNCE = 0.75;
    const MAX_SPEED = 22;
    const MIN_VELOCITY = 0.15;
    const BASE_STEP = 1000 / 60;

    moonSize = moon.offsetWidth || (window.innerWidth <= 600 ? 100 : 180) * uiScale;

    const savedX = toNumber(storage.get('moonX'), NaN);
    const savedY = toNumber(storage.get('moonY'), NaN);
    const hasSavedMoon = Number.isFinite(savedX) && Number.isFinite(savedY);
    const savedUiScale = toNumber(storage.get('moonUiScale'), uiScale);
    const moonScaleRatio = savedUiScale > 0 ? uiScale / savedUiScale : 1;

    if (hasSavedMoon) {
      // Po zmianie rozdzielczości pozycja księżyca jest przeliczana tak,
      // żeby stał w tym samym miejscu względem ekranu.
      posX = savedX * moonScaleRatio;
      posY = savedY * moonScaleRatio;
    } else {
      const margin = (window.innerWidth <= 600 ? 130 : 300) * uiScale;
      posX = window.innerWidth - margin;
      posY = 60 * uiScale;
    }

    velX = toNumber(storage.get('moonVelX'), 0);
    velY = toNumber(storage.get('moonVelY'), 0);
    idleStart = toNumber(storage.get('moonIdleStart'), 0);
    const savedTime = toNumber(storage.get('moonSaveTime'), 0);

    function bounds() {
      return {
        maxX: Math.max(0, window.innerWidth - moonSize),
        maxY: Math.max(0, window.innerHeight - moonSize)
      };
    }

    // ====== EKSTRAPOLACJA RUCHU PO ZMIANIE STRONY ======
    // Symulujemy do 8 sekund w tle (max 480 klatek), więc księżyc
    // nie "cofa się" po wejściu na nową podstronę.
    if (savedTime > 0 && (Math.abs(velX) > 0.01 || Math.abs(velY) > 0.01)) {
      const elapsed = clamp((nowMs() - savedTime) / 1000, 0, 8);
      const frames = Math.min(Math.round(elapsed * 60), 480);
      const limit = bounds();

      for (let i = 0; i < frames; i++) {
        velX *= FRICTION;
        velY *= FRICTION;
        posX += velX;
        posY += velY;

        if (posX <= 0) { posX = 0; velX = Math.abs(velX) * BOUNCE; }
        else if (posX >= limit.maxX) { posX = limit.maxX; velX = -Math.abs(velX) * BOUNCE; }

        if (posY <= 0) { posY = 0; velY = Math.abs(velY) * BOUNCE; }
        else if (posY >= limit.maxY) { posY = limit.maxY; velY = -Math.abs(velY) * BOUNCE; }
      }
    }

    const initialLimit = bounds();
    posX = clamp(posX, 0, initialLimit.maxX);
    posY = clamp(posY, 0, initialLimit.maxY);
    if (Math.abs(velX) < MIN_VELOCITY) velX = 0;
    if (Math.abs(velY) < MIN_VELOCITY) velY = 0;

    // ====== LEWITACJA (CSS, BEZ KLATKOWEGO RYSU) ======
    // Faza liczona od momentu wejścia w idle. Dzięki temu po wytraceniu
    // prędkości księżyc zaczyna lewitację od zera, a nie teleportuje się.
    function floatPhase() {
      if (!idleStart) return 0;
      const seconds = (nowMs() - idleStart) / 1000;
      return ((seconds % 6) + 6) % 6;
    }

    function applyFloatPhase() {
      if (!moonImg) return;
      moonImg.style.animationDelay = moon.classList.contains('idle')
        ? (-floatPhase()).toFixed(3) + 's'
        : '0s';
    }

    function renderMoon() {
      moon.style.transform = `translate3d(${posX.toFixed(2)}px, ${posY.toFixed(2)}px, 0)`;
    }

    function enterIdle(resetPhase) {
      if (resetPhase || !idleStart) idleStart = nowMs();
      moon.classList.add('idle');
      applyFloatPhase();
      velX = 0;
      velY = 0;
      physicsRunning = false;
      storage.set('moonVelX', 0);
      storage.set('moonVelY', 0);
      storage.set('moonIdleStart', idleStart);
    }

    function leaveIdle() {
      moon.classList.remove('idle');
      if (moonImg) moonImg.style.animationDelay = '0s';
    }

    // ====== FIZYKA ======
    function stepPhysics(timestamp) {
      if (!physicsRunning) return;
      if (isDragging) { physicsRunning = false; return; }

      if (!lastPhysicsTs) lastPhysicsTs = timestamp;
      let dt = (timestamp - lastPhysicsTs) / BASE_STEP;
      lastPhysicsTs = timestamp;

      // Po powrocie z zakładki w tle nie pozwalamy księżycowi wystrzelić.
      if (dt > 3) dt = 3;
      if (dt <= 0) { window.requestAnimationFrame(stepPhysics); return; }

      const damping = Math.pow(FRICTION, dt);
      velX *= damping;
      velY *= damping;
      posX += velX * dt;
      posY += velY * dt;

      const limit = bounds();
      if (posX <= 0) { posX = 0; velX = Math.abs(velX) * BOUNCE; }
      else if (posX >= limit.maxX) { posX = limit.maxX; velX = -Math.abs(velX) * BOUNCE; }

      if (posY <= 0) { posY = 0; velY = Math.abs(velY) * BOUNCE; }
      else if (posY >= limit.maxY) { posY = limit.maxY; velY = -Math.abs(velY) * BOUNCE; }

      renderMoon();

      if (Math.abs(velX) > MIN_VELOCITY || Math.abs(velY) > MIN_VELOCITY) {
        window.requestAnimationFrame(stepPhysics);
      } else {
        enterIdle(true);
        storage.set('moonX', posX.toFixed(2));
        storage.set('moonY', posY.toFixed(2));
        storage.set('moonUiScale', uiScale.toFixed(4));
        storage.set('moonIdleStart', idleStart);
      }
    }

    function startPhysics() {
      if (physicsRunning || isDragging) return;
      physicsRunning = true;
      lastPhysicsTs = 0;
      window.requestAnimationFrame(stepPhysics);
    }

    // ====== STAN POCZĄTKOWY ======
    renderMoon();

    if (Math.abs(velX) > MIN_VELOCITY || Math.abs(velY) > MIN_VELOCITY) {
      leaveIdle();
      if (hasSavedMoon) moon.classList.add('loaded', 'instant');
      else window.requestAnimationFrame(() => moon.classList.add('loaded'));
      startPhysics();
    } else {
      velX = 0;
      velY = 0;
      if (!idleStart) idleStart = nowMs();
      moon.classList.add('idle');
      applyFloatPhase();
      if (hasSavedMoon) moon.classList.add('loaded', 'instant');
      else window.requestAnimationFrame(() => moon.classList.add('loaded'));
    }

    // ====== PRZECIĄGANIE ======
    let offsetX = 0;
    let offsetY = 0;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let lastMoveTime = 0;
    let dragStartClientX = 0;
    let dragStartClientY = 0;
    let dragMoved = false;
    let dragHadIdle = false;
    let dragBaseX = 0;
    let dragBaseY = 0;
    let dragIdleStart = 0;

    function updateDragPosition(clientX, clientY) {
      posX = clamp(clientX - offsetX, 0, Math.max(0, window.innerWidth - moonSize));
      posY = clamp(clientY - offsetY, 0, Math.max(0, window.innerHeight - moonSize));
      renderMoon();
    }

    moon.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (isDragging) return;

      const rect = moon.getBoundingClientRect();
      // Obrazek może być aktualnie przesunięty przez animację lewitacji.
      // Bierzemy jego rzeczywisty prostokąt, żeby złapanie nie powodowało skoku.
      const imgRect = moonImg ? moonImg.getBoundingClientRect() : rect;

      // Zapamiętujemy stan sprzed "wchłonięcia" offsetu lewitacji.
      // Jeśli użytkownik tylko kliknie, przywrócimy dokładnie tę samą fazę.
      dragBaseX = rect.left;
      dragBaseY = rect.top;
      dragIdleStart = idleStart;
      dragHadIdle = moon.classList.contains('idle');
      dragMoved = false;
      dragStartClientX = event.clientX;
      dragStartClientY = event.clientY;

      // Najpierw "wchłaniamy" aktualny offset lewitacji do pozycji kontenera.
      // Dzięki temu po wyłączeniu animacji CSS księżyc nie skacze.
      posX = imgRect.left;
      posY = imgRect.top;
      renderMoon();
      leaveIdle();

      isDragging = true;
      physicsRunning = false;
      moon.style.cursor = 'grabbing';

      offsetX = event.clientX - posX;
      offsetY = event.clientY - posY;
      lastMouseX = event.clientX;
      lastMouseY = event.clientY;
      lastMoveTime = performance.now();

      velX = 0;
      velY = 0;

      if (moon.setPointerCapture) {
        try { moon.setPointerCapture(event.pointerId); } catch (err) { /* ignoruj */ }
      }
    });

    document.addEventListener('pointermove', event => {
      if (!isDragging) return;

      if (event.pointerType === 'mouse' && event.buttons === 0) {
        finishDrag(event);
        return;
      }

      updateDragPosition(event.clientX, event.clientY);

      if (!dragMoved) {
        const dx = event.clientX - dragStartClientX;
        const dy = event.clientY - dragStartClientY;
        if (dx * dx + dy * dy > 9) dragMoved = true;
      }

      const time = performance.now();
      const dt = Math.max(1, time - lastMoveTime);
      // Prędkość unormowana do 60 klatek — taka sama feel na 60/120/144 Hz.
      velX = clamp(((event.clientX - lastMouseX) / dt) * BASE_STEP * 0.8, -MAX_SPEED, MAX_SPEED);
      velY = clamp(((event.clientY - lastMouseY) / dt) * BASE_STEP * 0.8, -MAX_SPEED, MAX_SPEED);

      lastMouseX = event.clientX;
      lastMouseY = event.clientY;
      lastMoveTime = time;
    }, { passive: true });

    function finishDrag(event) {
      if (!isDragging) return;
      isDragging = false;
      moon.style.cursor = 'grab';

      if (event && event.pointerId !== undefined && moon.releasePointerCapture) {
        try { moon.releasePointerCapture(event.pointerId); } catch (err) { /* ignoruj */ }
      }

      // Samo kliknięcie (bez ruchu) nie może przesuwać księżyca —
      // wracamy do pozycji bazowej i tej samej fazy lewitacji.
      if (!dragMoved && dragHadIdle) {
        posX = dragBaseX;
        posY = dragBaseY;
        idleStart = dragIdleStart;
        renderMoon();
        enterIdle(false);
        storage.set('moonX', posX.toFixed(2));
        storage.set('moonY', posY.toFixed(2));
        storage.set('moonUiScale', uiScale.toFixed(4));
        storage.set('moonIdleStart', idleStart);
        return;
      }

      storage.set('moonX', posX.toFixed(2));
      storage.set('moonY', posY.toFixed(2));
      storage.set('moonUiScale', uiScale.toFixed(4));

      if (Math.abs(velX) > 0.5 || Math.abs(velY) > 0.5) {
        startPhysics();
      } else {
        enterIdle(true);
      }
    }

    document.addEventListener('pointerup', finishDrag);
    document.addEventListener('pointercancel', finishDrag);

    // ====== ZMIANA ROZMIARU ======
    let resizeFrame = 0;
    window.addEventListener('resize', () => {
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = 0;
        const nextUiScale = readUiScale();
        const scaleRatio = uiScale > 0 ? nextUiScale / uiScale : 1;

        if (scaleRatio !== 1 && !isDragging) {
          posX *= scaleRatio;
          posY *= scaleRatio;
          velX *= scaleRatio;
          velY *= scaleRatio;
        }

        uiScale = nextUiScale;
        moonSize = moon.offsetWidth || moonSize;
        const limit = bounds();
        posX = clamp(posX, 0, limit.maxX);
        posY = clamp(posY, 0, limit.maxY);
        renderMoon();
        refreshTargetRects();
      });
    }, { passive: true });
  }

  // ====== RADAR (PODŚWIETLANIE GUI) ======
  // Prostokąty elementów są cache'owane. W pętli nie ma getBoundingClientRect,
  // więc księżyc nie wymusza przeliczania layoutu 60 razy na sekundę.
  const glowTargets = Array.from(document.querySelectorAll('.glow-target'));
  const RADAR_INTERVAL = 90;
  let targetRects = [];
  let lastRadarTs = 0;

  function refreshTargetRects() {
    targetRects = glowTargets.map(element => {
      const rect = element.getBoundingClientRect();
      return {
        element,
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        near: element.classList.contains('near-moon')
      };
    });
  }

  function floatOffsetForRadar() {
    if (!moon || !moon.classList.contains('idle') || !idleStart) return { x: 0, y: 0 };
    const seconds = (nowMs() - idleStart) / 1000;
    const phase = ((seconds % 6) + 6) % 6;
    const k = (1 - Math.cos((phase / 6) * TAU)) / 2;
    return { x: -10 * uiScale * k, y: -22 * uiScale * k };
  }

  function radarLoop(timestamp) {
    if (!moon) return;
    window.requestAnimationFrame(radarLoop);

    if (document.hidden) return;
    if (timestamp - lastRadarTs < RADAR_INTERVAL) return;
    lastRadarTs = timestamp;

    if (!targetRects.length) return;

    const offset = floatOffsetForRadar();
    const centerX = posX + offset.x + moonSize / 2;
    const centerY = posY + offset.y + moonSize / 2;
    // Promień poświaty rośnie razem z interfejsem (90 px przy Full HD,
    // 180 px przy 4K). Na telefonie zostaje 90 px, jak wcześniej.
    const glowRadius = 90 * uiScale;
    const glowRadiusSq = glowRadius * glowRadius;

    for (let i = 0; i < targetRects.length; i++) {
      const target = targetRects[i];
      const closestX = Math.max(target.left, Math.min(centerX, target.right));
      const closestY = Math.max(target.top, Math.min(centerY, target.bottom));
      const dx = centerX - closestX;
      const dy = centerY - closestY;
      const near = dx * dx + dy * dy < glowRadiusSq;

      if (near !== target.near) {
        target.near = near;
        target.element.classList.toggle('near-moon', near);
      }
    }
  }

  function scheduleTargetRefresh() {
    refreshTargetRects();
    window.setTimeout(refreshTargetRects, 900);
    window.setTimeout(refreshTargetRects, 1500);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => window.setTimeout(refreshTargetRects, 60));
    }
    window.addEventListener('load', refreshTargetRects);
    document.querySelectorAll('.drop-in').forEach(element => {
      element.addEventListener('animationend', event => {
        if (event.target === element && !document.body.classList.contains('page-exit')) {
          refreshTargetRects();
        }
      });
    });
  }

  scheduleTargetRefresh();
  window.requestAnimationFrame(radarLoop);

  // ====== GWIAZDY W TLE (JEDEN CANVAS) ======
  // Zamiast trzech ogromnych, animowanych warstw CSS rysujemy gwiazdy
  // na jednym canvasie. To działa płynnie także bez akceleracji sprzętowej.
  const canvas = document.getElementById('starfield');
  const spaceBg = document.getElementById('space-bg');
  const ctx = canvas ? canvas.getContext('2d', { alpha: true, desynchronized: true }) : null;

  let cw = 0;
  let ch = 0;
  let dpr = 1;
  let stars = [];
  let trailSprites = {};
  let canvasRaf = 0;
  let frameInterval = 1000 / 30;
  let shots = [];
  let nextSpawnAt = 0;
  let snapshotActive = false;
  let shotLayer = null;
  const shotVisuals = new Map();

  const MAX_SHOTS = 2;
  const SHOT_COLORS = ['#ffffff', '#4f8dff', '#fde047'];
  const MAX_DPR = lowPower ? 1 : 1.4;

  // Spadające gwiazdy dostają własną warstwę DOM animowaną przez przeglądarkę.
  // Dzięki temu ich ruch nie zależy od pętli canvasu (24-30 FPS) i jest płynny
  // nawet na dużych oknach. Canvas rysuje już tylko samo tło z gwiazdami.
  let shotDomMode = typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';

  // Gęstości i prędkości odwzorowują pierwszą wersję tła:
  // 6 gwiazd / 200 px, 4 / 300 px i 3 / 400 px.
  const STAR_LAYERS = [
    { countPerTile: 6, tileSize: 200, size: 1, halo: 0, driftSeconds: 60, twinkleSeconds: 3, colors: ['#ffffff'] },
    { countPerTile: 4, tileSize: 300, size: 2, halo: 4, driftSeconds: 120, twinkleSeconds: 5, colors: ['#ffffff'] },
    { countPerTile: 3, tileSize: 400, size: 3, halo: 7, driftSeconds: 180, twinkleSeconds: 7, colors: ['#fde047', '#fde047', '#60a5fa'] }
  ];
  const MAX_STARS = 3200;

  function computeStarCounts() {
    const area = cw * ch;
    const counts = STAR_LAYERS.map(layer => {
      const perPixel = layer.countPerTile / (layer.tileSize * layer.tileSize);
      return Math.round(area * perPixel);
    });
    const total = counts.reduce((sum, count) => sum + count, 0);
    if (total <= MAX_STARS) return counts;

    // Zabezpieczenie dla ekranów 5K/8K — nie rysujemy tysięcy gwiazd.
    const scale = MAX_STARS / total;
    return counts.map(count => Math.floor(count * scale));
  }

  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const starRandom = mulberry32(0xB0B15);

  function makeStar(layerIndex, index) {
    const layer = STAR_LAYERS[layerIndex];
    return {
      nx: starRandom(),
      ny: starRandom(),
      layer: layerIndex,
      size: layer.size,
      halo: layer.halo,
      color: layer.colors[index % layer.colors.length],
      phase: starRandom() * TAU,
      twinkleSpeed: TAU / layer.twinkleSeconds
    };
  }

  // Dodaje/usuwa tylko brakujące gwiazdy, więc resize nie resetuje całego pola.
  function syncStars(counts) {
    for (let layerIndex = 0; layerIndex < STAR_LAYERS.length; layerIndex++) {
      const target = counts[layerIndex] || 0;
      let current = 0;

      for (let i = 0; i < stars.length; i++) {
        if (stars[i].layer === layerIndex) current++;
      }

      while (current > target) {
        for (let i = stars.length - 1; i >= 0; i--) {
          if (stars[i].layer === layerIndex) {
            stars.splice(i, 1);
            break;
          }
        }
        current--;
      }

      while (current < target) {
        stars.push(makeStar(layerIndex, current));
        current++;
      }
    }
  }

  function drawStars(elapsed) {
    if (!ctx) return;

    const spanX = cw + 40;
    const spanY = ch + 40;
    const offsets = STAR_LAYERS.map(layer => ({
      x: elapsed * (cw / layer.driftSeconds),
      y: elapsed * (ch / layer.driftSeconds)
    }));
    let currentColor = '';

    for (let i = 0; i < stars.length; i++) {
      const star = stars[i];
      const offset = offsets[star.layer];

      if (star.color !== currentColor) {
        ctx.fillStyle = star.color;
        currentColor = star.color;
      }

      let x = (star.nx * spanX - offset.x) % spanX;
      if (x < 0) x += spanX;
      x -= 20;

      let y = (star.ny * spanY - offset.y) % spanY;
      if (y < 0) y += spanY;
      y -= 20;

      const alpha = 0.6 + 0.4 * Math.sin(elapsed * star.twinkleSpeed + star.phase);
      if (alpha < 0.03) continue;

      if (star.halo) {
        ctx.globalAlpha = alpha * 0.16;
        ctx.fillRect(
          x + star.size / 2 - star.halo / 2,
          y + star.size / 2 - star.halo / 2,
          star.halo,
          star.halo
        );
      }

      ctx.globalAlpha = alpha;
      ctx.fillRect(x, y, star.size, star.size);
    }

    ctx.globalAlpha = 1;
  }

  // ====== SPADAJĄCE GWIAZDY ======
  function hexToRgba(hex, alpha) {
    const value = hex.replace('#', '');
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function makeTrailSprite(color) {
    const scale = uiScale;
    const length = (cw < 600 ? 100 : 180) * scale;
    const headRadius = (cw < 600 ? 10 : 14) * scale;
    const padding = 4 * scale;
    const width = length + headRadius * 2 + padding * 2;
    const height = headRadius * 2 + padding * 2;
    const buffer = document.createElement('canvas');

    buffer.width = Math.ceil(width * dpr);
    buffer.height = Math.ceil(height * dpr);

    const bufferCtx = buffer.getContext('2d');
    bufferCtx.scale(dpr, dpr);

    const centerY = height / 2;
    const tailX = padding + headRadius;
    const headX = tailX + length;

    const gradient = bufferCtx.createLinearGradient(tailX, centerY, headX, centerY);
    gradient.addColorStop(0, hexToRgba(color, 0));
    gradient.addColorStop(0.75, hexToRgba(color, 0.55));
    gradient.addColorStop(1, hexToRgba(color, 1));

    bufferCtx.strokeStyle = gradient;
    bufferCtx.lineWidth = 2 * scale;
    bufferCtx.lineCap = 'round';
    bufferCtx.beginPath();
    bufferCtx.moveTo(tailX, centerY);
    bufferCtx.lineTo(headX, centerY);
    bufferCtx.stroke();

    const glow = bufferCtx.createRadialGradient(headX, centerY, 0, headX, centerY, headRadius);
    glow.addColorStop(0, hexToRgba(color, 0.95));
    glow.addColorStop(0.25, hexToRgba(color, 0.5));
    glow.addColorStop(1, hexToRgba(color, 0));
    bufferCtx.fillStyle = glow;
    bufferCtx.beginPath();
    bufferCtx.arc(headX, centerY, headRadius, 0, TAU);
    bufferCtx.fill();

    bufferCtx.fillStyle = color;
    bufferCtx.beginPath();
    bufferCtx.arc(headX, centerY, 2 * scale, 0, TAU);
    bufferCtx.fill();

    return { img: buffer, headX, w: width, h: height };
  }

  function buildTrailSprites() {
    trailSprites = {};
    SHOT_COLORS.forEach(color => {
      const sprite = makeTrailSprite(color);

      if (shotDomMode) {
        try {
          sprite.url = sprite.img.toDataURL('image/png');
          if (!sprite.url) shotDomMode = false;
        } catch (err) {
          shotDomMode = false;
        }
      }

      trailSprites[color] = sprite;
    });

    if (shotDomMode) rebuildShotVisuals();
    else clearShotVisuals();
  }

  function pickShotColor() {
    const roll = Math.random();
    if (roll > 0.7) return '#4f8dff';
    if (roll > 0.4) return '#fde047';
    return '#ffffff';
  }

  function addShot(startX, startY, angle, duration, color, spawnTime) {
    if (shots.length >= MAX_SHOTS) return;
    shots.push({
      startX,
      startY,
      angle,
      duration: Math.max(2500, duration),
      color,
      spawnTime
    });
  }

  function spawnShotPair(time) {
    if (shots.length >= MAX_SHOTS) {
      nextSpawnAt = time + 1000 + Math.random() * 2500;
      return;
    }

    const baseX = 5 + Math.random() * 35;
    const baseY = -20 - Math.random() * 20;
    const baseAngle = 65 + Math.random() * 20;
    const baseDuration = 3500 + Math.random() * 2500;

    addShot(baseX, baseY, baseAngle, baseDuration, pickShotColor(), time);

    if (shots.length < MAX_SHOTS && Math.random() < 0.4) {
      addShot(
        baseX + 3 + Math.random() * 5,
        baseY + 2 + Math.random() * 3,
        baseAngle + (Math.random() * 4 - 2),
        baseDuration + (Math.random() * 400 - 200),
        pickShotColor(),
        time
      );
    }

    nextSpawnAt = time + 1000 + Math.random() * 2500;
  }

  function saveShootingStars() {
    const time = nowMs();
    const active = shots.filter(shot => shot.spawnTime + shot.duration > time);
    storage.set('shootingStarsState', JSON.stringify({ active, nextSpawnAt }));
  }

  function restoreShootingStars() {
    const raw = storage.get('shootingStarsState');

    if (raw) {
      try {
        const state = JSON.parse(raw);
        const time = nowMs();

        if (state && Array.isArray(state.active)) {
          shots = state.active
            .filter(shot => shot && Number.isFinite(shot.spawnTime) && shot.spawnTime + shot.duration > time)
            .slice(0, MAX_SHOTS)
            .map(shot => ({
              startX: toNumber(shot.startX, 10),
              startY: toNumber(shot.startY, -25),
              angle: toNumber(shot.angle, 75),
              duration: Math.max(2500, toNumber(shot.duration, 4000)),
              color: SHOT_COLORS.indexOf(shot.color) !== -1 ? shot.color : '#ffffff',
              spawnTime: shot.spawnTime
            }));
        }

        if (state && Number.isFinite(state.nextSpawnAt)) nextSpawnAt = state.nextSpawnAt;
      } catch (err) {
        shots = [];
        nextSpawnAt = 0;
      }
    }

    const time = nowMs();
    // Jeśli strona była zamknięta bardzo długo, nie wystrzeliwujemy gwiazd serią.
    if (!nextSpawnAt || nextSpawnAt < time - 5000) {
      nextSpawnAt = time + 800 + Math.random() * 1700;
    }

    storage.remove('shootingStarsState');
  }

  function pruneExpiredShots(time) {
    for (let i = shots.length - 1; i >= 0; i--) {
      if (time - shots[i].spawnTime >= shots[i].duration) {
        removeShotVisual(shots[i]);
        shots.splice(i, 1);
      }
    }
  }

  function updateShootingStars(time) {
    pruneExpiredShots(time);
    if (time >= nextSpawnAt) spawnShotPair(time);
    ensureShotVisuals();
  }

  function drawShootingStars(time) {
    if (!ctx || !shots.length) return;

    const vmax = Math.max(cw, ch);

    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      const progress = (time - shot.spawnTime) / shot.duration;
      if (progress < 0 || progress > 1) continue;

      const radians = shot.angle * Math.PI / 180;
      const startX = (shot.startX / 100) * cw;
      const startY = (shot.startY / 100) * ch;
      const distance = progress * 2 * vmax;
      const headX = startX + Math.cos(radians) * distance;
      const headY = startY + Math.sin(radians) * distance;

      let alpha = 1;
      if (progress < 0.1) alpha = progress / 0.1;
      else if (progress > 0.9) alpha = (1 - progress) / 0.1;

      const sprite = trailSprites[shot.color] || trailSprites['#ffffff'];
      if (!sprite) continue;

      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.translate(headX, headY);
      ctx.rotate(radians);
      ctx.drawImage(sprite.img, -sprite.headX, -sprite.h / 2, sprite.w, sprite.h);
      ctx.restore();
    }
  }

  // ====== SPADAJĄCE GWIAZDY — WARSTWA ANIMOWANA ======
  function ensureShotLayer() {
    if (shotLayer || !spaceBg) return shotLayer;

    shotLayer = document.createElement('div');
    shotLayer.className = 'shooting-stars';
    shotLayer.setAttribute('aria-hidden', 'true');
    shotLayer.style.cssText =
      'position:absolute;inset:0;overflow:hidden;pointer-events:none;contain:strict;';
    spaceBg.appendChild(shotLayer);
    return shotLayer;
  }

  function shotTransform(shot, sprite, progress) {
    const vmax = Math.max(cw, ch);
    const radians = shot.angle * Math.PI / 180;
    const startX = (shot.startX / 100) * cw;
    const startY = (shot.startY / 100) * ch;
    const distance = progress * 2 * vmax;
    const headX = startX + Math.cos(radians) * distance;
    const headY = startY + Math.sin(radians) * distance;

    return `translate(${(headX - sprite.headX).toFixed(2)}px, ${(headY - sprite.h / 2).toFixed(2)}px) rotate(${shot.angle}deg)`;
  }

  function createShotVisual(shot) {
    if (!shotDomMode) return null;

    const sprite = trailSprites[shot.color] || trailSprites['#ffffff'];
    if (!sprite || !sprite.url) {
      // Brak sprite'a w trybie DOM — wracamy do rysowania na canvasie.
      shotDomMode = false;
      clearShotVisuals();
      return null;
    }

    const layer = ensureShotLayer();
    if (!layer) return null;

    const image = new Image();
    image.alt = '';
    image.draggable = false;
    image.src = sprite.url;
    // Obrazek ma punkt zaczepienia w głowie gwiazdy, tak jak sprite na canvasie.
    image.style.cssText =
      'position:absolute;left:0;top:0;pointer-events:none;user-select:none;-webkit-user-drag:none;' +
      `width:${sprite.w}px;height:${sprite.h}px;` +
      `transform-origin:${sprite.headX}px ${sprite.h / 2}px;` +
      'will-change:transform,opacity;';
    layer.appendChild(image);

    const elapsed = clamp(nowMs() - shot.spawnTime, 0, shot.duration);
    const frames = [
      { offset: 0, transform: shotTransform(shot, sprite, 0), opacity: 0 },
      { offset: 0.1, transform: shotTransform(shot, sprite, 0.1), opacity: 1 },
      { offset: 0.9, transform: shotTransform(shot, sprite, 0.9), opacity: 1 },
      { offset: 1, transform: shotTransform(shot, sprite, 1), opacity: 0 }
    ];

    let animation = null;
    try {
      animation = image.animate(frames, {
        duration: shot.duration,
        easing: 'linear',
        fill: 'forwards'
      });
      // Wznowiona gwiazda startuje od właściwego miejsca, a nie od początku.
      animation.currentTime = elapsed;
    } catch (err) {
      image.remove();
      // Animacja DOM nie wystartowała — od następnej klatki rysujemy na canvasie.
      shotDomMode = false;
      clearShotVisuals();
      return null;
    }

    const visual = { image, animation };
    shotVisuals.set(shot, visual);

    animation.finished.then(() => {
      if (shotVisuals.get(shot) === visual) removeShotVisual(shot);
    }).catch(() => { /* animacja anulowana przy sprzątaniu */ });

    return visual;
  }

  function removeShotVisual(shot) {
    const visual = shotVisuals.get(shot);
    if (!visual) return;

    shotVisuals.delete(shot);
    try { visual.animation.cancel(); } catch (err) { /* już zakończona */ }
    if (visual.image.parentNode) visual.image.parentNode.removeChild(visual.image);
  }

  function ensureShotVisuals() {
    if (!shotDomMode) return;
    for (let i = 0; i < shots.length; i++) {
      if (!shotVisuals.has(shots[i])) createShotVisual(shots[i]);
    }
  }

  function clearShotVisuals() {
    shotVisuals.forEach(visual => {
      try { visual.animation.cancel(); } catch (err) { /* już zakończona */ }
      if (visual.image.parentNode) visual.image.parentNode.removeChild(visual.image);
    });
    shotVisuals.clear();
  }

  function rebuildShotVisuals() {
    if (!shotDomMode) return;
    clearShotVisuals();
    ensureShotVisuals();
  }

  // Po powrocie z zakładki w tle animacje mogą być wstrzymane — ustawiamy je
  // ponownie na czas liczony od rozpoczęcia gwiazdy.
  function syncShotVisuals() {
    if (!shotDomMode) return;

    const time = nowMs();
    pruneExpiredShots(time);
    shotVisuals.forEach((visual, shot) => {
      const elapsed = time - shot.spawnTime;
      if (elapsed < 0) {
        removeShotVisual(shot);
        return;
      }
      try { visual.animation.currentTime = elapsed; } catch (err) { /* pomijamy */ }
    });

    ensureShotVisuals();
  }

  // ====== PĘTLA CANVASU ======
  // Zapisuje ostatnią klatkę gwiazd. Nowa podstrona pokaże ją od razu,
  // jeszcze przed pierwszym rysowaniem canvasu, więc tło pozostaje ciągłe.
  function saveStarSnapshot() {
    if (!canvas) return;
    try {
      storage.set('bgSnapshot', canvas.toDataURL('image/png'));
    } catch (err) { /* brak miejsca w sessionStorage */ }
  }

  function drawCanvasFrame() {
    const time = nowMs();
    const elapsed = Math.max(0, (time - starTime) / 1000);

    ctx.clearRect(0, 0, cw, ch);
    drawStars(elapsed);
    updateShootingStars(time);
    // W nowoczesnych przeglądarkach gwiazdy rysuje warstwa DOM animowana
    // przez compositor. Canvas zostaje jako fallback dla starszych silników.
    if (!shotDomMode) drawShootingStars(time);

    // Pierwsza własna klatka zastępuje zapisany obraz tła.
    if (snapshotActive) {
      snapshotActive = false;
      document.documentElement.classList.remove('bg-snapshot');
      document.documentElement.style.removeProperty('--bg-snapshot');
      storage.remove('bgSnapshot');
    }
  }

  function canvasLoop(timestamp) {
    canvasRaf = window.requestAnimationFrame(canvasLoop);
    if (document.hidden) return;
    if (timestamp - lastCanvasDraw < frameInterval) return;
    lastCanvasDraw = timestamp;
    drawCanvasFrame();
  }

  function resizeCanvas() {
    if (!canvas || !ctx || !spaceBg) return;

    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    if (width === cw && height === ch && canvas.width) return;

    cw = width;
    ch = height;
    uiScale = readUiScale();
    // Większe ekrany rysujemy trochę rzadziej, żeby nie obciążać CPU.
    frameInterval = 1000 / (lowPower || cw * ch > 2600000 ? 24 : 30);
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    syncStars(computeStarCounts());

    buildTrailSprites();
    lastCanvasDraw = 0;
  }

  if (canvas && ctx) {
    resizeCanvas();
    restoreShootingStars();
    snapshotActive = document.documentElement.classList.contains('bg-snapshot');
    // Rysujemy od razu, żeby gwiazdy były gotowe przed pierwszą klatką.
    drawCanvasFrame();
    canvasRaf = window.requestAnimationFrame(canvasLoop);

    let canvasResizeFrame = 0;
    window.addEventListener('resize', () => {
      if (canvasResizeFrame) window.cancelAnimationFrame(canvasResizeFrame);
      canvasResizeFrame = window.requestAnimationFrame(() => {
        canvasResizeFrame = 0;
        resizeCanvas();
      });
    }, { passive: true });
  }
})();
