// A single cloud keeps the source artwork's proportions while travelling from
// the logo to the two-line message. Only the offscreen masks contain images.
(() => {
  const canvas = document.querySelector("#atenea-canvas");
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return;

  const cursor = document.querySelector(".atenea-cursor");
  const story = document.querySelector("#atenea-story");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const logoMask = new Image();
  logoMask.src = "/images/atenea-mark.svg";

  const COLOR = "#39ff14";
  const BUCKETS = 6;
  const NAMES = ["logo", "marketing"];
  const ENTRY_DURATION = 1400;
  const first = new Int32Array(BUCKETS);
  const shapes = [], layouts = [], particles = [], waves = [];
  const pointer = { x: -9999, y: -9999, nx: 0, ny: 0, inside: false };
  const sourceBounds = { x: 0, y: 0, width: 0, height: 0 };
  const bounds = { x: 0, y: 0, width: 0, height: 0 };
  const center = { x: 0, y: 0 };
  const scroll = { progress: 0, total: 1, from: "logo", to: "marketing", mix: 0 };
  const entry = { progress: 0, complete: false };
  let width = 0, height = 0, dpr = 1;
  let logoWidth = 0, logoHeight = 0, sourceAspect = 1;
  let frame = 0, frames = 0, lastTimestamp = 0, entryStarted = 0;
  let tiltX = 0, tiltY = 0, maxDisplacement = 0;
  let ready = false, measured = false, reduced = motion.matches;

  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
  const mix = (from, to, amount) => from + (to - from) * amount;
  const smooth = (value) => value * value * (3 - 2 * value);

  function metrics() {
    canvas.dataset.particleReady = String(ready);
    canvas.dataset.particleCount = String(particles.length);
    canvas.dataset.particleFrames = String(frames);
    canvas.dataset.particleReducedMotion = String(reduced);
    canvas.dataset.particleActive = String(ready && !reduced && !document.hidden);
    canvas.dataset.particleShape = scroll.mix < 0.5 ? "ATENEA" : "marketing";
    canvas.dataset.particleEntryComplete = String(entry.complete);
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
        bounds: { ...bounds }, targetBounds: { ...bounds },
        sourceBounds: { ...sourceBounds }, sourceAspect,
        shape: scroll.mix < 0.5 ? "ATENEA" : "marketing",
        scroll: { ...scroll }, center: { ...center }, entry: { ...entry },
      }),
    }),
  });

  function sampleMask(source, density, original = false) {
    const surface = document.createElement("canvas");
    surface.width = source.naturalWidth || source.width;
    surface.height = source.naturalHeight || source.height;
    const maskContext = surface.getContext("2d", { willReadFrequently: true });
    maskContext.drawImage(source, 0, 0);
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
    const maskWidth = right - left + 1, maskHeight = bottom - top + 1;
    if (original) {
      Object.assign(sourceBounds, { x: left, y: top, width: maskWidth, height: maskHeight });
      sourceAspect = maskWidth / maskHeight;
    }
    // Bounds come from the complete source artwork. The interior test removes
    // only edge fragments whose dots would protrude into a counter or gap.
    const spacing = Math.sqrt(filled / (density * 1.08));
    const inset = Math.max(1.25, spacing * 0.43);
    const alpha = (x, y) => {
      const px = Math.round(x), py = Math.round(y);
      if (px < 0 || py < 0 || px >= surface.width || py >= surface.height) return 0;
      return pixels[(py * surface.width + px) * 4 + 3];
    };
    const interior = (x, y) => {
      if (alpha(x, y) < 240) return false;
      for (let direction = 0; direction < 8; direction++) {
        const angle = direction * Math.PI / 4;
        if (alpha(x + Math.cos(angle) * inset, y + Math.sin(angle) * inset) < 240) return false;
      }
      return true;
    };
    const points = [];
    // Keep the full regular grid, in row order, rather than randomly dropping
    // samples. Thin bars and both custom A shapes retain even coverage.
    for (let y = top + spacing / 2; y <= bottom; y += spacing) {
      for (let x = left + spacing / 2; x <= right; x += spacing) {
        if (!interior(x, y)) continue;
        points.push({
          x: (x - left - maskWidth / 2) / maskWidth,
          y: (y - top - maskHeight / 2) / maskWidth,
        });
      }
    }
    if (!points.length) throw new Error("The ATENEA particle grid is empty.");
    return { points, aspect: maskHeight / maskWidth, spacing: spacing / maskWidth };
  }

  function marketingMask() {
    const surface = document.createElement("canvas");
    surface.width = 1200;
    surface.height = 650;
    const maskContext = surface.getContext("2d");
    maskContext.fillStyle = "#ffffff";
    maskContext.font = '700 220px "Instrument Sans Variable", Arial, sans-serif';
    maskContext.textAlign = "left";
    maskContext.textBaseline = "alphabetic";
    maskContext.fillText("Marketing", 32, 265);
    maskContext.fillText("Digital", 32, 545);
    return surface;
  }

  function buildCloud(masks) {
    const count = Math.max(...masks.map((mask) => mask.points.length));
    for (const mask of masks) {
      const points = new Float32Array(count * 2);
      for (let i = 0; i < count; i++) {
        // Repeating evenly spaced samples keeps every original grid cell and
        // allows both masks to use exactly the same particle identities.
        const sample = mask.points[Math.floor(i * mask.points.length / count)];
        points[i * 2] = sample.x;
        points[i * 2 + 1] = sample.y;
      }
      shapes.push({ points, aspect: mask.aspect, spacing: mask.spacing });
    }
    for (let i = 0; i < count; i++) {
      particles.push({
        x: 0, y: 0, vx: 0, vy: 0, next: -1,
        entryDelay: ((i * 37) % 101) / 101 * 0.14,
        entryLift: Math.sin(i * 0.63) * 18,
      });
    }
  }

  function completeEntry() {
    entry.progress = 1;
    entry.complete = true;
  }

  function measureLayouts() {
    if (!shapes.length) return;
    const pageY = window.scrollY;
    for (let i = 0; i < NAMES.length; i++) {
      const panel = document.querySelector('[data-atenea-scene="' + NAMES[i] + '"]');
      const anchor = document.querySelector('[data-atenea-anchor="' + NAMES[i] + '"]');
      const panelRect = panel?.getBoundingClientRect();
      const rect = anchor?.getBoundingClientRect();
      const aspect = shapes[i].aspect;
      const availableWidth = rect?.width || width * (i ? 0.6 : 0.76);
      const availableHeight = rect?.height || height * 0.7;
      const shapeWidth = Math.max(40, Math.min(
        availableWidth * 0.98, availableHeight * 0.94 / aspect, i ? 1000 : 800
      ));
      const shapeHeight = shapeWidth * aspect;
      const marginX = Math.min(width / 2, shapeWidth / 2 + 10);
      const marginY = Math.min(height / 2, shapeHeight / 2 + 10);
      const x = rect ? rect.left + rect.width / 2 : width / 2;
      // Each anchor describes its final viewport position within its panel.
      // Subtracting the panel top avoids sending the logo offscreen on scroll.
      const y = rect && panelRect ? rect.top - panelRect.top + rect.height / 2 : height / 2;
      layouts[i] = {
        top: panelRect ? panelRect.top + pageY : i * height,
        x: clamp(x, marginX, width - marginX),
        y: clamp(y, marginY, height - marginY),
        width: shapeWidth, height: shapeHeight,
      };
    }
    logoWidth = layouts[0].width;
    logoHeight = layouts[0].height;
    measured = true;
    updateScroll();
  }

  function updateScroll() {
    if (!measured) return;
    scroll.progress = clamp(
      (window.scrollY - layouts[0].top) / Math.max(1, layouts[1].top - layouts[0].top),
      0, 1
    );
    scroll.mix = smooth(scroll.progress);
    if (scroll.progress > 0.001 || reduced) completeEntry();
    center.x = mix(layouts[0].x, layouts[1].x, scroll.mix);
    center.y = mix(layouts[0].y, layouts[1].y, scroll.mix);
    bounds.width = mix(layouts[0].width, layouts[1].width, scroll.mix);
    bounds.height = mix(layouts[0].height, layouts[1].height, scroll.mix);
    bounds.x = center.x - bounds.width / 2;
    bounds.y = center.y - bounds.height / 2;
    story?.style.setProperty("--intro-opacity", String(1 - smooth(clamp(scroll.progress / 0.65, 0, 1))));
    if (ready && reduced && !document.hidden) render(performance.now(), true);
    metrics();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width || innerWidth);
    height = Math.max(1, rect.height || innerHeight);
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
    if (!ready || !measured) return;
    const dt = staticFrame || !lastTimestamp ? 1 : clamp((timestamp - lastTimestamp) / 16.667, 0.3, 2);
    lastTimestamp = timestamp;
    if (!entry.complete) {
      entry.progress = clamp((timestamp - entryStarted) / ENTRY_DURATION, 0, 1);
      if (entry.progress === 1) completeEntry();
    }
    const ease = staticFrame ? 1 : 1 - Math.pow(0.86, dt);
    tiltX += ((pointer.inside ? pointer.ny * 0.016 : 0) - tiltX) * ease;
    tiltY += ((pointer.inside ? -pointer.nx * 0.018 : 0) - tiltY) * ease;
    const cosX = Math.cos(tiltX), sinX = Math.sin(tiltX);
    const cosY = Math.cos(tiltY), sinY = Math.sin(tiltY);
    const from = layouts[0], to = layouts[1], amount = scroll.mix;
    const sampleSpacing = mix(shapes[0].spacing * from.width, shapes[1].spacing * to.width, amount);
    const radius = clamp(sampleSpacing * 0.37, 0.85, 1.55);
    const influence = clamp(bounds.width * 0.1, 28, 65);
    const displacementLimit = waves.length ? 8 : clamp(bounds.height * 0.009, 2, 6);
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
      const point = particles[i], offset = i * 2;
      const modelX = mix(shapes[0].points[offset] * from.width, shapes[1].points[offset] * to.width, amount);
      const modelY = mix(shapes[0].points[offset + 1] * from.width, shapes[1].points[offset + 1] * to.width, amount);
      const modelZ = Math.sin(shapes[0].points[offset] * Math.PI * 2)
        * Math.cos(shapes[0].points[offset + 1] * Math.PI) * from.width * 0.004 * (1 - amount);
      const x = modelX * cosY + modelZ * sinY;
      const zAfterY = -modelX * sinY + modelZ * cosY;
      const y = modelY * cosX - zAfterY * sinX;
      const z = modelY * sinX + zAfterY * cosX;
      const perspective = 1 / (1 - (z - modelZ) / Math.max(bounds.width * 8, 1));
      const arrived = entry.complete ? 1 : smooth(clamp(
        (entry.progress - point.entryDelay) / (1 - point.entryDelay), 0, 1
      ));
      const entryOffset = (1 - arrived) * (width - center.x + bounds.width * 0.6 + 40);
      const targetX = center.x + x * perspective + entryOffset;
      const targetY = center.y + y * perspective + (1 - arrived) * point.entryLift;
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
        point.vx *= scale; point.vy *= scale;
      }
      maxDisplacement = Math.max(maxDisplacement, Math.hypot(point.x - targetX, point.y - targetY));
      const depth = clamp(0.5 + z / Math.max(bounds.width * 0.07, 1), 0, 1);
      const bucket = Math.min(BUCKETS - 1, Math.floor(depth * BUCKETS));
      point.next = first[bucket];
      first[bucket] = i;
    }

    context.clearRect(0, 0, width, height);
    context.fillStyle = COLOR;
    for (let bucket = 0; bucket < BUCKETS; bucket++) {
      if (first[bucket] === -1) continue;
      context.globalAlpha = 0.98 + bucket / (BUCKETS - 1) * 0.02;
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
      cursor.style.transform = "translate(" + pointer.x + "px, " + pointer.y + "px)";
      cursor.style.opacity = pointer.inside ? "1" : "0";
    }
    frames++;
    if (staticFrame || frames % 20 === 0 || frames === 1 || entry.complete) metrics();
  }

  function tick(timestamp) {
    frame = 0;
    if (reduced || document.hidden) return;
    render(timestamp);
    frame = requestAnimationFrame(tick);
  }

  function updatePointer(event) {
    if (event.target?.closest?.("a, button, input, select, textarea")) {
      leavePointer();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.nx = clamp(pointer.x / width * 2 - 1, -1, 1);
    pointer.ny = clamp(pointer.y / height * 2 - 1, -1, 1);
    pointer.inside = pointer.x >= 0 && pointer.x <= width && pointer.y >= 0 && pointer.y <= height;
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

  window.addEventListener("pointermove", updatePointer, { passive: true });
  canvas.addEventListener("pointerleave", leavePointer, { passive: true });
  window.addEventListener("pointerout", (event) => {
    if (!event.relatedTarget) leavePointer();
  }, { passive: true });
  window.addEventListener("pointercancel", leavePointer, { passive: true });
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
      wave(center.x, center.y);
    }
  });
  document.querySelector("#atenea-reset")?.addEventListener("click", () => {
    completeEntry();
    waves.length = 0;
    tiltX = tiltY = 0;
    leavePointer();
    if (ready && !document.hidden) render(performance.now(), true);
  });
  window.addEventListener("scroll", updateScroll, { passive: true });
  window.addEventListener("resize", resize, { passive: true });
  motion.addEventListener("change", (event) => {
    reduced = event.matches;
    waves.length = 0;
    if (reduced) {
      completeEntry();
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
      await Promise.all([
        logoMask.decode(),
        document.fonts.load('700 220px "Instrument Sans Variable"', "Marketing Digital"),
      ]);
      const density = innerWidth < 700 ? 4500 : 6000;
      buildCloud([
        sampleMask(logoMask, density, true),
        sampleMask(marketingMask(), density),
      ]);
      ready = true;
      entryStarted = performance.now();
      if (reduced || window.scrollY > 0) completeEntry();
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
