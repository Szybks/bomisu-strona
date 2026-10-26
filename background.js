// ====== OPTYMALIZACJA WYDAJNOŚCI: will-change dla animowanych elementów ======
(function injectPerfCss() {
  const style = document.createElement('style');
  style.textContent = `
    .stars-small, .stars-medium, .stars-large,
    .star-wrapper, .shooting-star,
    .moon-container, .moon-img {
      will-change: transform;
    }
    .shooting-star { will-change: transform, opacity; }
    .space-bg { contain: layout paint style; }
  `;
  document.head.appendChild(style);
})();

// ====== WSPÓLNA LOGIKA ANIMACJI TŁA (gwiazdy, księżyc) ======
// Plik dołączany do wszystkich podstron, aby tło było spójne i ciągłe.

// ====== ZAPAMIĘTYWANIE STANU GWIAZD I ANIMACJI ======
if (!sessionStorage.getItem('starTime')) {
  sessionStorage.setItem('starTime', Date.now());
}
const elapsedTime = (Date.now() - parseInt(sessionStorage.getItem('starTime'))) / 1000;

// (statyczne gwiazdy zsynchronizowane w <head>; tu nic nie robimy)

document.querySelectorAll('.moon-img').forEach(el => {
  el.style.animationDelay = `-${elapsedTime}s`;
});

// ====== NAWIGACJA ======
let isNavigating = false;
const pageName = p => (p.split('/').pop() || 'index').replace(/\.html$/, '');

function navigateTo(url) {
  if (isNavigating || pageName(url) === pageName(location.pathname)) return;
  isNavigating = true;
  document.body.classList.add('page-exit');

  setTimeout(() => {
    sessionStorage.setItem('moonX', posX);
    sessionStorage.setItem('moonY', posY);
    sessionStorage.setItem('moonVelX', velX);
    sessionStorage.setItem('moonVelY', velY);
    sessionStorage.setItem('moonSaveTime', Date.now());
    window.location.href = url;
  }, 580);
}

window.addEventListener('pageshow', (e) => {
  if (e.persisted) {
    isNavigating = false;
    document.body.classList.remove('page-exit');
  }
});

// ====== FIZYKA KSIĘŻYCA ======
const moon = document.getElementById('moon');
let isDragging = false;

let posX = parseFloat(sessionStorage.getItem('moonX'));
let posY = parseFloat(sessionStorage.getItem('moonY'));
const hasSavedMoon = !isNaN(posX) && !isNaN(posY);

let velX = parseFloat(sessionStorage.getItem('moonVelX')) || 0;
let velY = parseFloat(sessionStorage.getItem('moonVelY')) || 0;
const savedTime = parseInt(sessionStorage.getItem('moonSaveTime')) || 0;

if (!hasSavedMoon) {
  posX = window.innerWidth > 600 ? window.innerWidth - 300 : window.innerWidth - 130;
  posY = 60;
}

const friction = 0.995;
const bounce = 0.75;
const maxSpeed = 22;
const moonSize = (moon && moon.offsetWidth) || 180;

if (savedTime > 0 && (Math.abs(velX) > 0.01 || Math.abs(velY) > 0.01)) {
  const elapsedSeconds = (Date.now() - savedTime) / 1000;
  if (elapsedSeconds > 0) {
    const frames = Math.min(Math.round(elapsedSeconds * 60), 300);
    const maxX = window.innerWidth - moonSize;
    const maxY = window.innerHeight - moonSize;
    for (let i = 0; i < frames; i++) {
      velX *= friction; velY *= friction;
      posX += velX; posY += velY;
      if (posX <= 0) { posX = 0; velX = Math.abs(velX) * bounce; }
      else if (posX >= maxX) { posX = maxX; velX = -Math.abs(velX) * bounce; }
      if (posY <= 0) { posY = 0; velY = Math.abs(velY) * bounce; }
      else if (posY >= maxY) { posY = maxY; velY = -Math.abs(velY) * bounce; }
    }
  }
}

sessionStorage.removeItem('moonVelX');
sessionStorage.removeItem('moonVelY');
sessionStorage.removeItem('moonSaveTime');

let offsetX = 0, offsetY = 0;
let lastMouseX = 0, lastMouseY = 0;

if (moon) {
  moon.style.transform = `translate(${posX}px, ${posY}px)`;

  if (hasSavedMoon) {
    moon.classList.add('loaded', 'instant');
  } else {
    requestAnimationFrame(() => moon.classList.add('loaded'));
  }

  if (Math.abs(velX) > 0.5 || Math.abs(velY) > 0.5) {
    moon.classList.remove('idle');
    requestAnimationFrame(updatePhysics);
  } else {
    moon.classList.add('idle');
  }

  moon.addEventListener('pointerdown', (e) => {
    isDragging = true;
    moon.style.cursor = 'grabbing';
    moon.classList.remove('idle');
    const rect = moon.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    posX = rect.left; posY = rect.top;
    velX = 0; velY = 0;
    lastMouseX = e.clientX; lastMouseY = e.clientY;
  });
}

document.addEventListener('pointermove', (e) => {
  if (!isDragging || !moon) return;
  posX = e.clientX - offsetX;
  posY = e.clientY - offsetY;
  const maxX = window.innerWidth - moon.offsetWidth;
  const maxY = window.innerHeight - moon.offsetHeight;
  if (posX < 0) posX = 0;
  if (posX > maxX) posX = maxX;
  if (posY < 0) posY = 0;
  if (posY > maxY) posY = maxY;
  moon.style.transform = `translate(${posX}px, ${posY}px)`;
  velX = (e.clientX - lastMouseX) * 0.8;
  velY = (e.clientY - lastMouseY) * 0.8;
  lastMouseX = e.clientX; lastMouseY = e.clientY;
});

document.addEventListener('pointerup', () => {
  if (!isDragging || !moon) return;
  isDragging = false;
  moon.style.cursor = 'grab';
  if (velX > maxSpeed) velX = maxSpeed;
  if (velX < -maxSpeed) velX = -maxSpeed;
  if (velY > maxSpeed) velY = maxSpeed;
  if (velY < -maxSpeed) velY = -maxSpeed;
  sessionStorage.setItem('moonX', posX);
  sessionStorage.setItem('moonY', posY);
  if (Math.abs(velX) > 0.5 || Math.abs(velY) > 0.5) {
    requestAnimationFrame(updatePhysics);
  } else {
    moon.classList.add('idle');
  }
});

function updatePhysics() {
  if (isDragging || !moon) return;
  velX *= friction; velY *= friction;
  posX += velX; posY += velY;
  const maxX = window.innerWidth - moon.offsetWidth;
  const maxY = window.innerHeight - moon.offsetHeight;
  if (posX <= 0) { posX = 0; velX = Math.abs(velX) * bounce; }
  else if (posX >= maxX) { posX = maxX; velX = -Math.abs(velX) * bounce; }
  if (posY <= 0) { posY = 0; velY = Math.abs(velY) * bounce; }
  else if (posY >= maxY) { posY = maxY; velY = -Math.abs(velY) * bounce; }
  moon.style.transform = `translate(${posX}px, ${posY}px)`;
  if (Math.abs(velX) > 0.15 || Math.abs(velY) > 0.15) {
    requestAnimationFrame(updatePhysics);
  } else {
    moon.classList.add('idle');
    sessionStorage.setItem('moonX', posX);
    sessionStorage.setItem('moonY', posY);
  }
}

window.addEventListener('resize', () => {
  if (!moon) return;
  const maxX = window.innerWidth - moon.offsetWidth;
  const maxY = window.innerHeight - moon.offsetHeight;
  if (posX > maxX) posX = maxX;
  if (posY > maxY) posY = maxY;
  moon.style.transform = `translate(${posX}px, ${posY}px)`;
});

// ====== PŁYNNA LEWITACJA KSIĘŻYCA (seamless loop) ======
const moonImgEl = document.querySelector('.moon-img');
const sessionStartTime = parseInt(sessionStorage.getItem('starTime'));

function animateMoonFloat() {
  if (moonImgEl && !isDragging) {
    const t = (Date.now() - sessionStartTime) / 1000;
    const phase = (t / 6) * Math.PI * 2;
    const floatX = -5 * (1 - Math.cos(phase));   // 0..-10, płynnie wraca do 0
    const floatY = -11 * (1 - Math.cos(phase));  // 0..-22
    moonImgEl.style.transform = `translate(${floatX}px, ${floatY}px)`;
  } else if (moonImgEl) {
    moonImgEl.style.transform = 'none';
  }
  requestAnimationFrame(animateMoonFloat);
}
requestAnimationFrame(animateMoonFloat);

// ====== EFEKT PODŚWIETLENIA (RADAR) ======
const glowTargets = document.querySelectorAll('.glow-target');
const glowRadius = 90;

function checkProximity() {
  if (!moon) { requestAnimationFrame(checkProximity); return; }
  const moonRect = moon.getBoundingClientRect();
  const moonCenterX = moonRect.left + moonRect.width / 2;
  const moonCenterY = moonRect.top + moonRect.height / 2;
  // Najpierw odczyt wszystkich prostokątów (unika layout thrashing)
  const rects = Array.from(glowTargets).map(t => t.getBoundingClientRect());
  glowTargets.forEach((target, i) => {
    const rect = rects[i];
    const closestX = Math.max(rect.left, Math.min(moonCenterX, rect.right));
    const closestY = Math.max(rect.top, Math.min(moonCenterY, rect.bottom));
    const distance = Math.hypot(moonCenterX - closestX, moonCenterY - closestY);
    target.classList.toggle('near-moon', distance < glowRadius);
  });
  requestAnimationFrame(checkProximity);
}
requestAnimationFrame(checkProximity);

// ====== DYNAMICZNE SPADAJĄCE GWIAZDY ======
const spaceBg = document.getElementById('space-bg');
let activeStars = 0;
let starsVisible = false;
const activeStarDescriptors = [];
let nextSpawnAt = 0;

function spawnStar(startX, startY, angle, duration, spawnTime, colorClass) {
  if (!spaceBg) return;
  if (spawnTime === undefined) spawnTime = Date.now();
  const elapsed = (Date.now() - spawnTime) / 1000;
  if (elapsed >= duration) return; // już się skończyła
  if (activeStars >= 2 && spawnTime === undefined) return;
  // przywracanie nie liczy się do limitu w ten sam sposób, ale trzymamy limit
  if (activeStars >= 4) return;
  activeStars++;
  const wrapper = document.createElement('div');
  wrapper.classList.add('star-wrapper');
  const star = document.createElement('div');
  star.classList.add('shooting-star');
  if (colorClass === 'star-blue' || colorClass === 'star-yellow') {
    star.classList.add(colorClass);
  } else {
    const colorRoll = Math.random();
    if (colorRoll > 0.7) { star.classList.add('star-blue'); colorClass = 'star-blue'; }
    else if (colorRoll > 0.4) { star.classList.add('star-yellow'); colorClass = 'star-yellow'; }
    else { colorClass = ''; }
  }
  wrapper.style.transform = `translate(${startX}vw, ${startY}vh) rotate(${angle}deg)`;
  star.style.animation = `shoot ${duration}s linear forwards`;
  star.style.animationDelay = `-${elapsed}s`;
  wrapper.appendChild(star);
  spaceBg.appendChild(wrapper);
  if (!starsVisible) wrapper.style.opacity = '0';

  const desc = { startX, startY, angle, duration, spawnTime, colorClass };
  activeStarDescriptors.push(desc);

  const remaining = (duration - elapsed) * 1000;
  const removeTimer = setTimeout(() => {
    wrapper.remove();
    activeStars = Math.max(0, activeStars - 1);
    const i = activeStarDescriptors.indexOf(desc);
    if (i !== -1) activeStarDescriptors.splice(i, 1);
  }, remaining);
  star.addEventListener('animationend', () => {
    // fallback
  });
}

function scheduleNextStar() {
  const delay = 1000 + Math.random() * 2500;
  nextSpawnAt = Date.now() + delay;
  setTimeout(() => {
    const baseX = 5 + Math.random() * 35;
    const baseY = -20 - Math.random() * 20;
    const baseAngle = 65 + Math.random() * 20;
    const baseDuration = 3.5 + Math.random() * 2.5;
    spawnStar(baseX, baseY, baseAngle, baseDuration);
    if (Math.random() < 0.4) {
      const offX = 3 + Math.random() * 5;
      const offY = 2 + Math.random() * 3;
      const offAngle = (Math.random() * 4) - 2;
      spawnStar(baseX + offX, baseY + offY, baseAngle + offAngle, baseDuration + (Math.random() * 0.4 - 0.2));
    }
    scheduleNextStar();
  }, delay);
}

// ====== ZAPIS STANU PRZED OPUSZCZENIEM STRONY ======
function saveShootingStarsState() {
  try {
    const state = {
      active: activeStarDescriptors.slice(),
      nextSpawnAt: nextSpawnAt
    };
    sessionStorage.setItem('shootingStarsState', JSON.stringify(state));
  } catch (e) {}
}

window.addEventListener('pagehide', saveShootingStarsState);
window.addEventListener('beforeunload', saveShootingStarsState);

// ====== PRZYWRACANIE STANU PO ZAŁADOWANIU ======
function restoreShootingStarsState() {
  let state = null;
  try {
    const raw = sessionStorage.getItem('shootingStarsState');
    if (raw) state = JSON.parse(raw);
  } catch (e) { state = null; }

  if (state && Array.isArray(state.active)) {
    state.active.forEach(desc => {
      spawnStar(desc.startX, desc.startY, desc.angle, desc.duration, desc.spawnTime, desc.colorClass);
    });
  }

  if (state && state.nextSpawnAt) {
    const delay = state.nextSpawnAt - Date.now();
    if (delay <= 0) {
      scheduleNextStar();
    } else {
      setTimeout(scheduleNextStar, delay);
    }
  } else {
    scheduleNextStar();
  }

  starsVisible = true;
  if (spaceBg) {
    spaceBg.querySelectorAll('.star-wrapper').forEach(w => { w.style.opacity = ''; });
  }
  sessionStorage.removeItem('shootingStarsState');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', restoreShootingStarsState);
} else {
  restoreShootingStarsState();
}
