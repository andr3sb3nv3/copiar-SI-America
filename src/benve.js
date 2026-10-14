// One point cloud travels through the story. All masks use complete regular
// sampling grids. Dress colors and depth arrive with the final scroll scene.
(() => {
  const canvas = document.querySelector("#benve-canvas");
  const context = canvas.getContext("2d");
  const cursor = document.querySelector(".benve-cursor");
  const story = document.querySelector("#benve-story");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const logoMask = new Image();
  const dressMask = new Image();
  logoMask.src = "/images/benve-mark.svg";
  dressMask.src = "/images/benve-dress.svg";

  const POINT_COLOR = "#ffffff";
  const DRESS_COLORS = ["#ffffff", "#ded6ff", "#aebfff"];
  const DRESS_RGB = DRESS_COLORS.map((color) => [1, 3, 5].map((start) =>
    parseInt(color.slice(start, start + 2), 16)
  ));
  const NAMES = ["logo", "word", "dress"];
  const BUCKETS = 6;
  const first = new Int32Array(BUCKETS * DRESS_COLORS.length);
  const shapes = [], layouts = [], particles = [], waves = [];
  const pointer = { x: -9999, y: -9999, nx: 0, ny: 0, inside: false };
  const scroll = { progress: 0, total: 2, from: "logo", to: "word", mix: 0 };
  const center = { x: 0, y: 0 };
  const targetBounds = { x: 0, y: 0, width: 0, height: 0 };
  let width = 0, height = 0, dpr = 1, diameter = 0;
  let frame = 0, frames = 0, lastTimestamp = 0;
  let logoAngle = 0, tiltX = 0, tiltY = 0;
  let ready = false, reduced = motion.matches, maxDisplacement = 0;
  let sceneIndex = 0, sceneMix = 0, measured = false;

  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
  const mix = (a, b, amount) => a + (b - a) * amount;
  const smooth = (value) => value * value * (3 - 2 * value);
  const dressWeight = () => sceneIndex === 1 ? sceneMix : 0;

  function scenePalette() {
    const weight = dressWeight();
    if (weight === 0) return [POINT_COLOR];
    return DRESS_RGB.map((rgb) => "#" + rgb.map((channel) =>
      Math.round(mix(255, channel, weight)).toString(16).padStart(2, "0")
    ).join(""));
  }

  function closestTone(red, green, blue) {
    let tone = 0, shortest = Infinity;
    for (let i = 0; i < DRESS_RGB.length; i++) {
      const color = DRESS_RGB[i];
      const distance = (red - color[0]) ** 2 + (green - color[1]) ** 2 + (blue - color[2]) ** 2;
      if (distance < shortest) { shortest = distance; tone = i; }
    }
    return tone;
  }

  function metrics() {
    canvas.dataset.particleReady = String(ready);
    canvas.dataset.particleCount = String(particles.length);
    canvas.dataset.particleFrames = String(frames);
    canvas.dataset.particleReducedMotion = String(reduced);
    canvas.dataset.particleActive = String(ready && !reduced && !document.hidden);
    canvas.dataset.particleShape = NAMES[sceneMix < 0.5 ? sceneIndex : sceneIndex + 1];
  }

  Object.defineProperty(window, "__benveScene", {
    configurable: true,
    value: Object.freeze({
      getState: () => ({
        ready, frames, count: particles.length, color: POINT_COLOR,
        reducedMotion: reduced, active: ready && !reduced && !document.hidden,
        waves: waves.length, maxDisplacement,
        rotation: { x: tiltX, y: tiltY, z: logoAngle },
        pointer: { ...pointer }, size: { width, height, dpr, diameter },
        scroll: { ...scroll },
        shape: NAMES[sceneMix < 0.5 ? sceneIndex : sceneIndex + 1],
        center: { ...center }, targetBounds: { ...targetBounds },
        dressWeight: dressWeight(), palette: scenePalette(),
      }),
    }),
  });

  function sampleMask(source) {
    const surface = document.createElement("canvas");
    surface.width = source.width;
    surface.height = source.height;
    const maskContext = surface.getContext("2d", { willReadFrequently: true });
    maskContext.drawImage(source, 0, 0);
    const pixels = maskContext.getImageData(0, 0, surface.width, surface.height).data;
    let filled = 0, left = surface.width, right = 0, top = surface.height, bottom = 0;
    for (let y = 0; y < surface.height; y++) {
      for (let x = 0; x < surface.width; x++) {
        if (pixels[(y * surface.width + x) * 4 + 3] <= 100) continue;
        filled++;
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    if (filled < 1000) throw new Error("A particle mask is empty.");
    const maskWidth = right - left + 1, maskHeight = bottom - top + 1;
    const spacing = Math.sqrt(filled / 4800);
    const points = [];
    for (let y = top + spacing / 2; y <= bottom; y += spacing) {
      for (let x = left + spacing / 2; x <= right; x += spacing) {
        const offset = (Math.floor(y) * surface.width + Math.floor(x)) * 4;
        if (pixels[offset + 3] > 100) {
          points.push({
            x: (x - left - maskWidth / 2) / maskWidth,
            y: (y - top - maskHeight / 2) / maskWidth,
            tone: closestTone(pixels[offset], pixels[offset + 1], pixels[offset + 2]),
          });
        }
      }
    }
    return { points, aspect: maskHeight / maskWidth, spacing: spacing / maskWidth };
  }

  function wordMask() {
    const surface = document.createElement("canvas");
    surface.width = 1400;
    surface.height = 440;
    const wordContext = surface.getContext("2d");
    wordContext.fillStyle = "#ffffff";
    wordContext.font = '600 300px "Instrument Sans Variable", Arial, sans-serif';
    wordContext.textAlign = "center";
    wordContext.textBaseline = "alphabetic";
    wordContext.fillText("BENVE", 700, 330);
    return surface;
  }

  function buildCloud(masks) {
    // Repeat evenly distributed samples in smaller grids, retaining every row
    // and every glyph. This keeps the same particle identity in all scenes.
    const count = Math.max(...masks.map((mask) => mask.points.length));
    for (const mask of masks) {
      const points = new Float32Array(count * 2);
      const tones = new Uint8Array(count);
      const relief = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const sample = mask.points[Math.floor(i * mask.points.length / count)];
        points[i * 2] = sample.x;
        points[i * 2 + 1] = sample.y;
        tones[i] = sample.tone;
        // A gently rounded fabric surface makes the mouse perspective tangible.
        relief[i] = Math.max(0, 1 - (sample.x * 1.8) ** 2) * 0.065
          - sample.tone * 0.009;
      }
      shapes.push({ points, tones, relief, aspect: mask.aspect, spacing: mask.spacing });
    }
    for (let i = 0; i < count; i++) {
      particles.push({ x: 0, y: 0, vx: 0, vy: 0, radius: 1, next: -1 });
    }
  }

  function measureLayouts() {
    const pageY = window.scrollY;
    for (let i = 0; i < NAMES.length; i++) {
      const panel = document.querySelector(`[data-particle-scene="${NAMES[i]}"]`);
      const anchor = document.querySelector(`[data-particle-anchor="${NAMES[i]}"]`);
      const panelRect = panel?.getBoundingClientRect();
      const rect = anchor?.getBoundingClientRect();
      const aspect = shapes[i]?.aspect || 1;
      const availableWidth = rect?.width || width * 0.6;
      const availableHeight = rect?.height || height * 0.7;
      const shapeWidth = Math.max(60, Math.min(availableWidth * 0.96, availableHeight * 0.94 / aspect));
      const shapeHeight = shapeWidth * aspect;
      const marginX = Math.min(width / 2, shapeWidth / 2 + 12);
      const marginY = Math.min(height / 2, shapeHeight / 2 + 12);
      const x = rect ? rect.left + rect.width / 2 : width / 2;
      // Use each panel's resting viewport position, then interpolate centers.
      const y = rect && panelRect ? rect.top - panelRect.top + rect.height / 2 : height / 2;
      layouts[i] = {
        top: panelRect ? panelRect.top + pageY : i * height,
        x: clamp(x, marginX, width - marginX),
        y: clamp(y, marginY, height - marginY),
        width: shapeWidth, height: shapeHeight,
      };
    }
    measured = true;
    updateScroll();
  }

  function updateScroll() {
    if (!measured) return;
    const y = window.scrollY;
    sceneIndex = y < layouts[1].top ? 0 : 1;
    const start = layouts[sceneIndex].top, end = layouts[sceneIndex + 1].top;
    const progress = clamp((y - start) / Math.max(1, end - start), 0, 1);
    sceneMix = smooth(progress);
    scroll.progress = sceneIndex + progress;
    scroll.from = NAMES[sceneIndex];
    scroll.to = NAMES[sceneIndex + 1];
    scroll.mix = sceneMix;
    const from = layouts[sceneIndex], to = layouts[sceneIndex + 1];
    center.x = mix(from.x, to.x, sceneMix);
    center.y = mix(from.y, to.y, sceneMix);
    diameter = mix(from.width, to.width, sceneMix);
    targetBounds.width = diameter;
    targetBounds.height = mix(from.height, to.height, sceneMix);
    targetBounds.x = center.x - targetBounds.width / 2;
    targetBounds.y = center.y - targetBounds.height / 2;
    story?.style.setProperty("--intro-opacity", String(1 - smooth(clamp(scroll.progress / 0.6, 0, 1))));
    if (ready && reduced && !document.hidden) render(performance.now(), true);
    metrics();
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width || innerWidth;
    height = bounds.height || innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    measureLayouts();
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
    const logoWeight = sceneIndex === 0 ? 1 - sceneMix : 0;
    if (!staticFrame) logoAngle += 0.14 * dt / 60 * logoWeight;
    const ease = staticFrame ? 1 : 1 - Math.pow(0.88, dt);
    tiltX += ((pointer.inside ? pointer.ny * 0.04 : 0) - tiltX) * ease;
    tiltY += ((pointer.inside ? -pointer.nx * 0.045 : 0) - tiltY) * ease;
    const cosZ = Math.cos(logoAngle), sinZ = Math.sin(logoAngle);
    const cosX = Math.cos(tiltX), sinX = Math.sin(tiltX);
    const cosY = Math.cos(tiltY), sinY = Math.sin(tiltY);
    const from = shapes[sceneIndex], to = shapes[sceneIndex + 1];
    const fromLayout = layouts[sceneIndex], toLayout = layouts[sceneIndex + 1];
    const fabricWeight = dressWeight();
    const palette = scenePalette();
    const influence = Math.min(94, Math.max(52, diameter * 0.2));
    const damping = Math.pow(0.83, dt);
    const radius = clamp(mix(from.spacing * fromLayout.width, to.spacing * toLayout.width, sceneMix) * 0.28, 0.72, 1.3);
    first.fill(-1);
    maxDisplacement = 0;
    if (!staticFrame) {
      for (let i = waves.length - 1; i >= 0; i--) {
        waves[i].radius += 15 * dt;
        if (waves[i].radius > Math.max(width, height) * 1.2) waves.splice(i, 1);
      }
    }

    for (let i = 0; i < particles.length; i++) {
      const point = particles[i], offset = i * 2;
      let ax = from.points[offset], ay = from.points[offset + 1];
      if (sceneIndex === 0) {
        const rotatedX = ax * cosZ - ay * sinZ;
        ay = ax * sinZ + ay * cosZ;
        ax = rotatedX;
      }
      const modelX = mix(ax * fromLayout.width, to.points[offset] * toLayout.width, sceneMix);
      const modelY = mix(ay * fromLayout.width, to.points[offset + 1] * toLayout.width, sceneMix);
      const modelZ = shapes[2].relief[i] * layouts[2].width * fabricWeight;
      const x = modelX * cosY + modelZ * sinY;
      const zAfterY = -modelX * sinY + modelZ * cosY;
      const y = modelY * cosX - zAfterY * sinX;
      const z = modelY * sinX + zAfterY * cosX;
      const perspective = 1 / (1 - z / (Math.max(diameter, 200) * 4.5));
      const targetX = center.x + x * perspective, targetY = center.y + y * perspective;
      let forceX = 0, forceY = 0;
      const dx = targetX - pointer.x, dy = targetY - pointer.y;
      const distance = Math.hypot(dx, dy);
      if (pointer.inside && distance < influence) {
        const power = Math.pow(1 - distance / influence, 1.7) * 1.9;
        forceX = (distance > 0.1 ? dx / distance : 1) * power;
        forceY = (distance > 0.1 ? dy / distance : 0) * power;
      }
      for (const wave of waves) {
        const wx = point.x - wave.x, wy = point.y - wave.y;
        const distance = Math.hypot(wx, wy) || 1;
        if (Math.abs(distance - wave.radius) < 25) {
          forceX += wx / distance * 4.2;
          forceY += wy / distance * 4.2;
        }
      }
      if (staticFrame) {
        point.x = targetX + forceX * 2;
        point.y = targetY + forceY * 2;
        point.vx = point.vy = 0;
      } else {
        point.vx = (point.vx + ((targetX - point.x) * 0.105 + forceX) * dt) * damping;
        point.vy = (point.vy + ((targetY - point.y) * 0.105 + forceY) * dt) * damping;
        point.x += point.vx * dt;
        point.y += point.vy * dt;
      }
      point.radius = radius;
      const depth = clamp(0.5 + z / Math.max(diameter * 0.2, 1), 0, 1);
      const tone = fabricWeight > 0 ? shapes[2].tones[i] : 0;
      const bucket = tone * BUCKETS + Math.min(BUCKETS - 1, Math.floor(depth * BUCKETS));
      point.next = first[bucket];
      first[bucket] = i;
      maxDisplacement = Math.max(maxDisplacement, Math.hypot(point.x - targetX, point.y - targetY));
    }

    context.clearRect(0, 0, width, height);
    for (let bucket = 0; bucket < first.length; bucket++) {
      if (first[bucket] === -1) continue;
      context.fillStyle = palette[Math.floor(bucket / BUCKETS)] || POINT_COLOR;
      context.globalAlpha = 0.96 + (bucket % BUCKETS) / (BUCKETS - 1) * 0.04;
      context.beginPath();
      for (let i = first[bucket]; i !== -1; i = particles[i].next) {
        const point = particles[i];
        context.moveTo(point.x + point.radius, point.y);
        context.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
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
    const bounds = canvas.getBoundingClientRect();
    pointer.x = event.clientX - bounds.left;
    pointer.y = event.clientY - bounds.top;
    pointer.nx = pointer.x / width * 2 - 1;
    pointer.ny = pointer.y / height * 2 - 1;
    pointer.inside = true;
    if (ready && reduced) render(performance.now(), true);
  }

  function leavePointer() {
    pointer.inside = false;
    pointer.x = pointer.y = -9999;
    if (cursor) cursor.style.opacity = "0";
    if (ready && reduced) render(performance.now(), true);
  }

  function wave(x, y) {
    if (!ready || reduced) return;
    if (waves.length >= 5) waves.shift();
    waves.push({ x, y, radius: 0 });
  }

  window.addEventListener("pointermove", updatePointer, { passive: true });
  window.addEventListener("pointerout", (event) => {
    if (!event.relatedTarget) leavePointer();
  }, { passive: true });
  window.addEventListener("pointercancel", leavePointer, { passive: true });
  window.addEventListener("pointerdown", (event) => {
    if (event.target.closest?.("button, a, input, textarea, select")) return;
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
      wave(center.x, center.y);
    }
  });
  document.querySelector("#benve-reset")?.addEventListener("click", () => {
    waves.length = 0;
    tiltX = tiltY = 0;
    pointer.inside = false;
    pointer.x = pointer.y = -9999;
    if (ready) render(performance.now(), true);
  });
  window.addEventListener("scroll", updateScroll, { passive: true });
  window.addEventListener("resize", resize, { passive: true });
  motion.addEventListener("change", (event) => {
    reduced = event.matches;
    waves.length = 0;
    if (reduced) {
      stop();
      if (ready) render(performance.now(), true);
    } else start();
    metrics();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (reduced && ready) render(performance.now(), true);
    else start();
  });
  window.addEventListener("pagehide", stop);
  window.addEventListener("pageshow", () => {
    if (ready && reduced) render(performance.now(), true);
    else start();
  });
  new ResizeObserver(resize).observe(canvas);
  document.querySelectorAll(".benve-panel").forEach((panel) => new ResizeObserver(resize).observe(panel));

  async function initialize() {
    try {
      await Promise.all([
        logoMask.decode(), dressMask.decode(),
        document.fonts.load('600 300px "Instrument Sans Variable"'),
      ]);
      buildCloud([sampleMask(logoMask), sampleMask(wordMask()), sampleMask(dressMask)]);
      ready = true;
      resize();
      metrics();
    } catch (error) {
      const message = document.createElement("p");
      message.setAttribute("role", "alert");
      message.textContent = "No pudimos cargar los puntos. Recargá la página.";
      message.style.cssText = "position:fixed;inset:50% 0 auto;text-align:center";
      canvas.after(message);
      console.error(error);
    }
  }
  initialize();
})();
