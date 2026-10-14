// The original artwork is sampled as one mask. A single scale preserves the
// relationship between the large symbol and both small A symbols in ATENEA.
(() => {
  const canvas = document.querySelector("#atenea-canvas");
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return;

  const cursor = document.querySelector(".atenea-cursor");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const mask = new Image();
  mask.src = "/images/atenea-mark.svg";

  const COLOR = "#00cc66";
  const BUCKETS = 6;
  const first = new Int32Array(BUCKETS);
  const particles = [];
  const waves = [];
  const pointer = { x: -9999, y: -9999, nx: 0, ny: 0, inside: false };
  const sourceBounds = { x: 0, y: 0, width: 0, height: 0 };
  const bounds = { x: 0, y: 0, width: 0, height: 0 };
  let width = 0, height = 0, dpr = 1;
  let logoWidth = 0, logoHeight = 0, sourceAspect = 1, sampleSpacing = 1;
  let frame = 0, frames = 0, lastTimestamp = 0;
  let tiltX = 0, tiltY = 0, maxDisplacement = 0;
  let ready = false, reduced = motion.matches;

  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

  function metrics() {
    canvas.dataset.particleReady = String(ready);
    canvas.dataset.particleCount = String(particles.length);
    canvas.dataset.particleFrames = String(frames);
    canvas.dataset.particleReducedMotion = String(reduced);
    canvas.dataset.particleActive = String(ready && !reduced && !document.hidden);
    canvas.dataset.particleShape = "ATENEA";
  }

  Object.defineProperty(window, "__ateneaScene", {
    configurable: true,
    value: Object.freeze({
      getState: () => ({
        ready, count: particles.length, color: COLOR, frames,
        active: ready && !reduced && !document.hidden,
        reducedMotion: reduced, waves: waves.length, maxDisplacement,
        rotation: { x: tiltX, y: tiltY, z: 0 },
        pointer: { ...pointer },
        size: { width, height, dpr, logoWidth, logoHeight },
        bounds: { ...bounds }, sourceBounds: { ...sourceBounds }, sourceAspect,
        shape: "ATENEA",
      }),
    }),
  });

  function sampleMask() {
    const surface = document.createElement("canvas");
    surface.width = mask.naturalWidth;
    surface.height = mask.naturalHeight;
    const maskContext = surface.getContext("2d", { willReadFrequently: true });
    maskContext.drawImage(mask, 0, 0);
    const pixels = maskContext.getImageData(0, 0, surface.width, surface.height).data;
    let filled = 0, left = surface.width, right = -1, top = surface.height, bottom = -1;
    for (let y = 0; y < surface.height; y++) {
      for (let x = 0; x < surface.width; x++) {
        if (pixels[(y * surface.width + x) * 4 + 3] <= 100) continue;
        filled++;
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    if (filled < 1000) throw new Error("The ATENEA particle mask is empty.");
    Object.assign(sourceBounds, {
      x: left, y: top, width: right - left + 1, height: bottom - top + 1,
    });
    sourceAspect = sourceBounds.width / sourceBounds.height;
    const density = canvas.getBoundingClientRect().width < 700 ? 3800 : 5000;
    const spacing = Math.sqrt(filled / density);
    sampleSpacing = spacing / sourceBounds.width;
    // Every occupied grid cell is kept, including the narrow wordmark bars.
    // Both axes use source width, so the artwork is never stretched to fit.
    for (let y = top + spacing / 2; y <= bottom; y += spacing) {
      for (let x = left + spacing / 2; x <= right; x += spacing) {
        const offset = (Math.floor(y) * surface.width + Math.floor(x)) * 4;
        if (pixels[offset + 3] <= 100) continue;
        const modelX = (x - left - sourceBounds.width / 2) / sourceBounds.width;
        const modelY = (y - top - sourceBounds.height / 2) / sourceBounds.width;
        particles.push({
          modelX, modelY,
          // Tiny symmetric relief gives the hover a little depth while the
          // resting view remains exactly the flat source artwork.
          modelZ: Math.sin(modelX * Math.PI * 2) * Math.cos(modelY * Math.PI) * 0.004,
          x: 0, y: 0, vx: 0, vy: 0, next: -1,
        });
      }
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    logoWidth = Math.min(width * 0.92, height * 0.9 * sourceAspect, 800);
    logoHeight = logoWidth / sourceAspect;
    Object.assign(bounds, {
      x: (width - logoWidth) / 2, y: (height - logoHeight) / 2,
      width: logoWidth, height: logoHeight,
    });
    if (!ready) return;
    render(performance.now(), true);
    start();
  }

  function start() {
    if (!ready || reduced || document.hidden || frame) return;
    lastTimestamp = 0;
    frame = requestAnimationFrame(tick);
    metrics();
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTimestamp = 0;
    metrics();
  }

  function render(timestamp, staticFrame = false) {
    if (!ready) return;
    const dt = staticFrame || !lastTimestamp ? 1 : clamp((timestamp - lastTimestamp) / 16.667, 0.3, 2);
    lastTimestamp = timestamp;
    const ease = staticFrame ? 1 : 1 - Math.pow(0.86, dt);
    tiltX += ((pointer.inside ? pointer.ny * 0.016 : 0) - tiltX) * ease;
    tiltY += ((pointer.inside ? -pointer.nx * 0.018 : 0) - tiltY) * ease;
    const cosX = Math.cos(tiltX), sinX = Math.sin(tiltX);
    const cosY = Math.cos(tiltY), sinY = Math.sin(tiltY);
    const centerX = width / 2, centerY = height / 2;
    const radius = clamp(sampleSpacing * logoWidth * 0.29, 0.75, 1.4);
    const influence = clamp(logoWidth * 0.1, 28, 65);
    const displacementLimit = waves.length ? 8 : clamp(logoHeight * 0.009, 2, 6);
    const damping = Math.pow(0.78, dt);
    first.fill(-1);
    maxDisplacement = 0;

    if (!staticFrame) {
      for (let i = waves.length - 1; i >= 0; i--) {
        waves[i].radius += 12 * dt;
        if (waves[i].radius > Math.hypot(width, height)) waves.splice(i, 1);
      }
    }

    for (let i = 0; i < particles.length; i++) {
      const point = particles[i];
      const modelX = point.modelX * logoWidth;
      const modelY = point.modelY * logoWidth;
      const modelZ = point.modelZ * logoWidth;
      const x = modelX * cosY + modelZ * sinY;
      const zAfterY = -modelX * sinY + modelZ * cosY;
      const y = modelY * cosX - zAfterY * sinX;
      const z = modelY * sinX + zAfterY * cosX;
      // Relief changes perspective only while tilting; at rest both axes
      // use the exact same scale, preserving the original triangular outline.
      const perspective = 1 / (1 - (z - modelZ) / Math.max(logoWidth * 8, 1));
      const targetX = centerX + x * perspective, targetY = centerY + y * perspective;
      let forceX = 0, forceY = 0;
      const dx = targetX - pointer.x, dy = targetY - pointer.y;
      const distance = Math.hypot(dx, dy);
      if (pointer.inside && distance < influence) {
        const power = Math.pow(1 - distance / influence, 1.7) * 0.52;
        forceX = (distance > 0.1 ? dx / distance : 1) * power;
        forceY = (distance > 0.1 ? dy / distance : 0) * power;
      }
      for (const wave of waves) {
        const wx = targetX - wave.x, wy = targetY - wave.y;
        const distance = Math.hypot(wx, wy) || 1;
        const band = Math.abs(distance - wave.radius);
        if (band < 20) {
          const strength = (1 - band / 20) * 0.95;
          forceX += wx / distance * strength;
          forceY += wy / distance * strength;
        }
      }
      if (staticFrame) {
        point.x = targetX + forceX * 2;
        point.y = targetY + forceY * 2;
        point.vx = point.vy = 0;
      } else {
        point.vx = (point.vx + ((targetX - point.x) * 0.18 + forceX) * dt) * damping;
        point.vy = (point.vy + ((targetY - point.y) * 0.18 + forceY) * dt) * damping;
        point.x += point.vx * dt;
        point.y += point.vy * dt;
      }
      const stretchX = point.x - targetX, stretchY = point.y - targetY;
      const stretch = Math.hypot(stretchX, stretchY);
      if (stretch > displacementLimit) {
        const scale = displacementLimit / stretch;
        point.x = targetX + stretchX * scale;
        point.y = targetY + stretchY * scale;
        point.vx *= scale;
        point.vy *= scale;
      }
      maxDisplacement = Math.max(maxDisplacement, Math.hypot(point.x - targetX, point.y - targetY));
      const depth = clamp(0.5 + z / Math.max(logoWidth * 0.07, 1), 0, 1);
      const bucket = Math.min(BUCKETS - 1, Math.floor(depth * BUCKETS));
      point.next = first[bucket];
      first[bucket] = i;
    }

    context.clearRect(0, 0, width, height);
    context.fillStyle = COLOR;
    for (let bucket = 0; bucket < BUCKETS; bucket++) {
      if (first[bucket] === -1) continue;
      context.globalAlpha = 0.97 + bucket / (BUCKETS - 1) * 0.03;
      context.beginPath();
      for (let i = first[bucket]; i !== -1; i = particles[i].next) {
        const point = particles[i];
        context.moveTo(point.x + radius, point.y);
        context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      }
      context.fill();
    }
    context.globalAlpha = 1;
    if (cursor) {
      cursor.style.transform = `translate(${pointer.x}px, ${pointer.y}px)`;
      cursor.style.opacity = pointer.inside ? "1" : "0";
    }
    frames++;
    if (staticFrame || frames % 20 === 0 || frames === 1) metrics();
  }

  function tick(timestamp) {
    frame = 0;
    if (reduced || document.hidden) return;
    render(timestamp);
    frame = requestAnimationFrame(tick);
  }

  function updatePointer(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.nx = clamp(pointer.x / width * 2 - 1, -1, 1);
    pointer.ny = clamp(pointer.y / height * 2 - 1, -1, 1);
    pointer.inside = true;
    if (ready && reduced && !document.hidden) render(performance.now(), true);
  }

  function leavePointer() {
    pointer.inside = false;
    pointer.x = pointer.y = -9999;
    pointer.nx = pointer.ny = 0;
    if (cursor) cursor.style.opacity = "0";
    if (ready && reduced && !document.hidden) render(performance.now(), true);
  }

  function wave(x, y) {
    if (!ready || reduced || document.hidden) return;
    if (waves.length >= 4) waves.shift();
    waves.push({ x, y, radius: 0 });
    metrics();
  }

  canvas.addEventListener("pointermove", updatePointer, { passive: true });
  canvas.addEventListener("pointerleave", leavePointer, { passive: true });
  canvas.addEventListener("pointercancel", leavePointer, { passive: true });
  canvas.addEventListener("pointerdown", (event) => {
    updatePointer(event);
    wave(pointer.x, pointer.y);
  }, { passive: true });
  window.addEventListener("pointerup", (event) => {
    if (event.pointerType === "touch") leavePointer();
  }, { passive: true });
  window.addEventListener("blur", leavePointer);
  canvas.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      wave(width / 2, height / 2);
    }
  });
  document.querySelector("#atenea-reset")?.addEventListener("click", () => {
    waves.length = 0;
    tiltX = tiltY = 0;
    leavePointer();
    if (ready && !document.hidden) render(performance.now(), true);
  });
  window.addEventListener("resize", resize, { passive: true });
  motion.addEventListener("change", (event) => {
    reduced = event.matches;
    waves.length = 0;
    if (reduced) {
      stop();
      if (ready && !document.hidden) render(performance.now(), true);
    } else start();
    metrics();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (ready && reduced) render(performance.now(), true);
    else start();
  });
  window.addEventListener("pagehide", stop);
  window.addEventListener("pageshow", () => {
    if (ready && reduced) render(performance.now(), true);
    else start();
  });
  new ResizeObserver(resize).observe(canvas);

  async function initialize() {
    try {
      await mask.decode();
      sampleMask();
      ready = true;
      resize();
      metrics();
    } catch (error) {
      const message = document.createElement("p");
      message.setAttribute("role", "alert");
      message.textContent = "No pudimos cargar el logo. Recargá la página.";
      canvas.after(message);
      console.error(error);
    }
  }
  metrics();
  initialize();
})();
