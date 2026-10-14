// Particle typography and interactions adapted from the public SI.gov site.
const __si = () => {
  if (window.__siInitialized) return;
  window.__siInitialized = true;
  const t = document.getElementById("view"),
    e = document.querySelector("footer");
  t &&
    e &&
    t.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_PRECEDING &&
    e.parentNode.insertBefore(t, e);
  const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  let n = motionQuery.matches;
  const o = matchMedia("(pointer: fine)").matches,
    a = (t, e = document) => e.querySelector(t),
    r = (t, e = document) => [...e.querySelectorAll(t)],
    i = (t, e, n) => Math.max(e, Math.min(n, t));
  let s = new Image();
  ((s.crossOrigin = "anonymous"), (s.src = "/images/seal.png"));
  const c = (() => {
    const t = document.createElement("canvas");
    ((t.width = 800), (t.height = 600));
    const e = t.getContext("2d");
    return (
      (e.fillStyle = "#fff"),
      e.beginPath(),
      e.moveTo(80, 300),
      e.lineTo(400, 165),
      e.lineTo(720, 300),
      e.closePath(),
      e.fill(),
      e.fillRect(120, 300, 560, 250),
      e.fillRect(352, 95, 96, 90),
      e.beginPath(),
      e.moveTo(336, 98),
      e.lineTo(400, 30),
      e.lineTo(464, 98),
      e.closePath(),
      e.fill(),
      e.fillRect(398, 2, 5, 32),
      e.fillRect(403, 4, 58, 34),
      e.fillRect(90, 550, 620, 18),
      e.fillRect(330, 568, 140, 14),
      e.fillRect(310, 582, 180, 14),
      (e.globalCompositeOperation = "destination-out"),
      e.beginPath(),
      e.arc(400, 140, 22, Math.PI, 0),
      e.lineTo(422, 172),
      e.lineTo(378, 172),
      e.closePath(),
      e.fill(),
      e.beginPath(),
      e.arc(400, 255, 26, 0, 2 * Math.PI),
      e.fill(),
      [
        [165, 345],
        [265, 345],
        [455, 345],
        [555, 345],
      ].forEach(([t, n]) => e.fillRect(t, n, 80, 110)),
      e.beginPath(),
      e.moveTo(352, 550),
      e.lineTo(352, 445),
      e.arc(400, 445, 48, Math.PI, 0),
      e.lineTo(448, 550),
      e.closePath(),
      e.fill(),
      e.fillRect(403, 15, 58, 6),
      e.fillRect(403, 27, 58, 5),
      (e.globalCompositeOperation = "source-over"),
      [
        [165, 345],
        [265, 345],
        [455, 345],
        [555, 345],
      ].forEach(([t, n]) => {
        (e.fillRect(t + 37, n, 6, 110), e.fillRect(t, n + 52, 80, 6));
      }),
      e.beginPath(),
      e.arc(400, 140, 9, 0, 2 * Math.PI),
      e.fill(),
      t
    );
  })();
  s.onload = () => {
    try {
      const t = document.createElement("canvas"),
        e = t.getContext("2d");
      ((t.width = s.naturalWidth),
        (t.height = s.naturalHeight),
        e.drawImage(s, 0, 0));
      const n = e.getImageData(0, 0, t.width, t.height).data;
      let o = t.width,
        a = t.height,
        r = 0,
        i = 0;
      for (let e = 0; e < t.height; e += 2)
        for (let s = 0; s < t.width; s += 2)
          n[4 * (e * t.width + s) + 3] > 40 &&
            (s < o && (o = s),
            s > r && (r = s),
            e < a && (a = e),
            e > i && (i = e));
      if (r > o && i > a) {
        const t = document.createElement("canvas");
        ((t.width = r - o + 2),
          (t.height = i - a + 2),
          t.getContext("2d").drawImage(s, -o, -a),
          (s = t));
      }
    } catch (t) {}
    if ((I.clear(), v.startsWith("image:"))) {
      const t = v;
      ((v = ""), $(t));
    }
  };
  const l = a("#field"),
    h = l.getContext("2d");
  let d = 0,
    u = 0,
    m = 1,
    f = 0,
    g = [];
  const p = ["#F5F6FA", "#FF3347", "#8FB4FF"];
  let y = {
      x: -9999,
      y: -9999,
      nx: 0,
      ny: 0,
    },
    M = [],
    x = null,
    v = "",
    b = 1,
    w = 1,
    E = 0,
    L = 1;
  function P() {
    ((m = Math.min(devicePixelRatio || 1, 2)),
      (d = innerWidth),
      (u = innerHeight),
      (l.width = d * m),
      (l.height = u * m),
      h.setTransform(m, 0, 0, m, 0, 0));
    const t = d < 700 ? 1500 : 1800;
    (g.length !== t &&
      (g = Array.from({ length: t }, (t, e) => ({
        x: Math.random() * d,
        y: Math.random() * u,
        vx: 0,
        vy: 0,
        c: Math.random() < 0.08 ? 1 : Math.random() < 0.12 ? 2 : 0,
        hx: Math.random(),
        hy: Math.random(),
        r: Math.random(),
      }))),
      (f = g.length));
  }
  const I = new Map(),
    C = {};
  let particleBooted = false,
    particleReady = false,
    particleFrames = 0,
    particleFrame = 0;
  let maxDisplacement = 0,
    peakVelocity = 0;
  const visibleFrames = new Map(),
    deferredFrames = new Set(),
    motionPausedFrames = new Set();
  function requestVisibleFrame(callback) {
    if (document.hidden) {
      deferredFrames.add(callback);
      return 0;
    }
    const handle = requestAnimationFrame((timestamp) => {
      visibleFrames.delete(handle);
      callback(timestamp);
    });
    visibleFrames.set(handle, callback);
    return handle;
  }
  function cancelVisibleFrame(handle) {
    cancelAnimationFrame(handle);
    visibleFrames.delete(handle);
  }
  function redrawScene() {
    if (!particleBooted || document.hidden) return;
    if (n) {
      if (particleFrame) cancelVisibleFrame(particleFrame);
      particleFrame = 0;
      R(performance.now());
    } else if (!particleFrame) particleFrame = requestVisibleFrame(R);
  }
  function syncParticleMetrics() {
    l.dataset.particleReady = String(particleReady);
    l.dataset.particleShape = v;
    l.dataset.particleFrames = String(particleFrames);
    l.dataset.particleCount = String(f);
    l.dataset.particleReducedMotion = String(n);
    l.dataset.particleActive = String(particleBooted && !n && !document.hidden);
  }
  Object.defineProperty(window, "__particleScene", {
    configurable: true,
    value: Object.freeze({
      getState: () => ({
        ready: particleReady,
        shape: v,
        form: v,
        frames: particleFrames,
        particleCount: f,
        count: f,
        waves: M.length,
        maxDisplacement,
        peakVelocity,
        reducedMotion: n,
        active: particleBooted && !n && !document.hidden,
        mouse: {
          x: y.x,
          y: y.y,
          nx: y.nx,
          ny: y.ny,
        },
        size: {
          width: d,
          height: u,
          dpr: m,
        },
      }),
    }),
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      for (const [handle, callback] of visibleFrames) {
        cancelAnimationFrame(handle);
        deferredFrames.add(callback);
      }
      visibleFrames.clear();
      particleFrame = 0;
      syncParticleMetrics();
    } else {
      const pending = [...deferredFrames];
      deferredFrames.clear();
      for (const callback of pending) {
        if (callback === R) continue;
        requestVisibleFrame(callback);
      }
      redrawScene();
      syncParticleMetrics();
    }
  });
  motionQuery.addEventListener("change", (event) => {
    n = event.matches;
    if (n) {
      if (particleFrame) cancelVisibleFrame(particleFrame);
      particleFrame = 0;
      M.length = 0;
      deferredFrames.delete(R);
    } else {
      for (const callback of motionPausedFrames) requestVisibleFrame(callback);
      motionPausedFrames.clear();
    }
    const cursor = a("#cursor");
    if (cursor) cursor.style.display = n ? "none" : "";
    redrawScene();
    syncParticleMetrics();
  });
  l.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (!n)
      M.push({
        x: d / 2,
        y: u / 2,
        r: 0,
      });
    redrawScene();
  });
  function S(t, e) {
    const n = `${t}|${0 | e.x},${0 | e.y},${0 | e.w},${0 | e.h}|${e.fit || 0}|${f}`;
    if (I.has(n)) return I.get(n);
    const o = document.createElement("canvas"),
      a = o.getContext("2d"),
      r = Math.max(10, Math.round(e.w)),
      i = Math.max(10, Math.round(e.h));
    ((o.width = r), (o.height = i));
    const s = t.includes("|")
        ? t.split("|")
        : d < 900 && t.includes(" ")
          ? t.split(" ")
          : [t],
      c = (t) => `400 ${t}px "Instrument Serif", Georgia, serif`;
    ((a.font = c(100)), (a.textBaseline = "alphabetic"));
    const l = s.map((t) => a.measureText(t)),
      h = Math.max(
        ...l.map(
          (t) =>
            (t.actualBoundingBoxLeft || 0) +
            (t.actualBoundingBoxRight || t.width),
        ),
      ),
      u = (l[0].actualBoundingBoxAscent || 72) / 100,
      m =
        u +
        0.92 * (s.length - 1) +
        (l[l.length - 1].actualBoundingBoxDescent || 22) / 100,
      g = Math.min(
        (r * (e.fit || 0.86)) / (h / 100),
        (i * (e.fitH || 0.9)) / m,
      );
    ((a.font = c(g)), (a.textAlign = "center"), (a.fillStyle = "#000"));
    const p = 0.92 * g,
      y = (i - m * g) / 2 + u * g;
    let M = 0;
    const x = s.map((t, e) => {
        const n = a.measureText(t).width,
          o = [],
          i = [];
        for (let e = 0; e <= t.length; e++)
          o.push(a.measureText(t.slice(0, e)).width);
        for (let e = 0; e < t.length; e++) i.push(" " === t[e] ? -1 : M++);
        return (
          a.fillText(t, r / 2, y + e * p),
          {
            y: y + e * p - 0.3 * g,
            x0: r / 2 - n / 2,
            pref: o,
            gi: i,
          }
        );
      }),
      v = a.getImageData(0, 0, r, i).data;
    let b = 0;
    for (let t = 3; t < v.length; t += 16) v[t] > 128 && (b += 4);
    const w = Math.max(1.5, Math.sqrt(b / (0.95 * f))),
      E = [];
    let L = 1e9,
      P = 1e9,
      C = -1e9,
      S = -1e9;
    for (let t = 0; t < i; t += w)
      for (let n = 0; n < r; n += w) {
        if (v[4 * (Math.floor(t) * r + Math.floor(n)) + 3] <= 128) continue;
        let o = x[0];
        for (const e of x) Math.abs(e.y - t) < Math.abs(o.y - t) && (o = e);
        const a = n - o.x0;
        let i = 0;
        for (; i < o.gi.length - 1 && o.pref[i + 1] <= a; ) i++;
        let s = o.gi[i];
        s < 0 && (s = o.gi[Math.max(0, i - 1)]);
        const c = e.x + n,
          l = e.y + t;
        (E.push([c, l, s]),
          c < L && (L = c),
          c > C && (C = c),
          l < P && (P = l),
          l > S && (S = l));
      }
    for (let t = E.length - 1; t > 0; t--) {
      const e = (Math.random() * (t + 1)) | 0;
      [E[t], E[e]] = [E[e], E[t]];
    }
    const T = {
      pts: E,
      n: M,
      step: w,
      box: {
        x0: L,
        y0: P,
        x1: C,
        y1: S,
      },
    };
    return (I.set(n, T), T);
  }
  const T = {
    text(t, e) {
      const n = S(t, e),
        o = n.pts;
      if (!o.length) return T.scatter();
      const a = (t) => {
        const e = o[t % o.length],
          n = t >= o.length;
        return [
          e[0] + (n ? 3 * (g[t].hx - 0.5) : 0),
          e[1] + (n ? 3 * (g[t].hy - 0.5) : 0),
          1,
          -1,
          1.7,
        ];
      };
      return ((a.box = n.box), a);
    },
    circle(t, e) {
      const o = `circ|${t}|${0 | e.x},${0 | e.y},${0 | e.w},${0 | e.h}|${f}`,
        a = Math.max(10, Math.round(e.w)),
        r = Math.max(10, Math.round(e.h)),
        i = a / 2,
        s = r / 2,
        c = 0.39 * Math.min(a, r);
      let l = I.get(o);
      if (!l) {
        const e = document.createElement("canvas"),
          n = e.getContext("2d");
        ((e.width = a),
          (e.height = r),
          (n.fillStyle = "#000"),
          (n.textAlign = "center"),
          (n.textBaseline = "middle"));
        const h = [...t],
          d = 0.42 * c;
        ((n.font = `400 ${d}px "Instrument Serif", Georgia, serif`),
          (n.strokeStyle = "#000"),
          (n.lineWidth = 0.05 * d),
          (n.lineJoin = "round"),
          h.forEach((t, e) => {
            const o = -Math.PI / 2 + (e / h.length) * Math.PI * 2;
            (n.save(),
              n.translate(i + c * Math.cos(o), s + c * Math.sin(o)),
              n.rotate(o + Math.PI / 2),
              n.fillText(t, 0, 0),
              n.strokeText(t, 0, 0),
              n.restore());
          }));
        const u = n.getImageData(0, 0, a, r).data;
        let m = 0;
        for (let t = 3; t < u.length; t += 4) u[t] > 128 && m++;
        let g = Math.max(2.5, Math.sqrt(m / (0.95 * f)));
        for (let t = 0; t < 6; t++) {
          l = [];
          for (let t = g / 2; t < r; t += g)
            for (let e = g / 2; e < a; e += g) {
              if (u[4 * ((0 | t) * a + (0 | e)) + 3] <= 128) continue;
              const n = e - i,
                o = t - s;
              l.push([Math.hypot(n, o), Math.atan2(o, n), 0, !0]);
            }
          if (l.length <= f) break;
          g *= 1.01 * Math.sqrt(l.length / (0.97 * f));
        }
        for (let t = l.length - 1; t > 0; t--) {
          const e = (Math.random() * (t + 1)) | 0;
          [l[t], l[e]] = [l[e], l[t]];
        }
        I.set(o, l);
      }
      if (!l.length) return T.scatter();
      const h = e.x + i,
        m = e.y + s,
        p = performance.now() / 1e3;
      return (t) => {
        if (t >= l.length) {
          const e = g[t];
          return [e.hx * d, e.hy * u, 0.12 + 0.1 * e.r, -1, 1];
        }
        const e = l[t],
          o = performance.now() / 1e3 - p,
          a = e[1] + (n ? 0 : 0.35 * Math.max(0, o - 0.6)),
          r = o < 0.7 ? 0.07 : Math.min(0.32, 0.07 + 0.6 * (o - 0.7));
        return [h + e[0] * Math.cos(a), m + e[0] * Math.sin(a), 1, -1, 1.6, r];
      };
    },
    image(t, e) {
      const n = "school" === t ? c : s,
        o = n.naturalWidth || n.width,
        a = n.naturalHeight || n.height;
      if (!o || !1 === n.complete) return T.scatter();
      const r = `img3|${t}|${0 | e.x},${0 | e.y},${0 | e.w},${0 | e.h}|${f}`;
      let i = I.get(r);
      if (!i) {
        const s = Math.max(10, Math.round(e.w)),
          c = Math.max(10, Math.round(e.h)),
          l = Math.min((0.96 * s) / o, (0.96 * c) / a),
          h = o * l,
          d = a * l,
          u = (s - h) / 2,
          m = (c - d) / 2,
          g = document.createElement("canvas"),
          p = g.getContext("2d");
        ((g.width = s),
          (g.height = c),
          ("school" === t
            ? [[0, 0]]
            : [
                [0, 0],
                [0.6, 0],
                [0, 0.6],
                [1, 0],
                [0, 1],
              ]
          ).forEach(([t, e]) => p.drawImage(n, u + t, m + e, h, d)));
        const y = p.getImageData(0, 0, s, c).data,
          M = (t, e) => (
            (e |= 0),
            (t |= 0) < 0 || e < 0 || t >= s || e >= c
              ? 0
              : y[4 * (e * s + t) + 3]
          );
        let x = 0;
        for (let t = 3; t < y.length; t += 16) y[t] > 110 && (x += 4);
        let v = Math.max(1.5, Math.sqrt(x / (0.95 * f)));
        for (let t = 0; t < 5; t++) {
          i = [];
          for (let t = v / 2; t < c; t += v)
            for (let n = v / 2; n < s; n += v)
              M(n, t) <= 110 || i.push([e.x + n, e.y + t]);
          if (i.length <= f) break;
          v *= 1.01 * Math.sqrt(i.length / (0.97 * f));
        }
        for (let t = i.length - 1; t > 0; t--) {
          const e = (Math.random() * (t + 1)) | 0;
          [i[t], i[e]] = [i[e], i[t]];
        }
        I.set(r, i);
      }
      return i.length
        ? (t, e) => {
            if (t >= i.length) {
              const e = g[t];
              return [e.hx * d, e.hy * u, 0.1 + 0.1 * e.r, -1, 1];
            }
            const n = i[t];
            return [n[0], n[1], 1, -1, 1.7];
          }
        : T.scatter();
    },
    snake(t, e) {
      const o = S(t, e);
      if (!o.pts.length) return T.scatter();
      const a = o.step,
        r = e.x,
        i = o.pts.slice().sort((t, e) => {
          if (t[2] !== e[2]) return t[2] - e[2];
          const n = Math.round((t[0] - r) / a),
            o = Math.round((e[0] - r) / a);
          return n !== o ? n - o : n % 2 ? e[1] - t[1] : t[1] - e[1];
        }),
        s = i.length,
        c = x,
        l = performance.now() / 1e3,
        h = (t, e) => {
          const o = t % s,
            a = n ? s + 70 : ((performance.now() / 1e3 - l) / 2.4) * (s + 70);
          if (o < a - 70) {
            const t = i[o];
            return [t[0], t[1], 1, -1, 1.7];
          }
          if (o < a) {
            const t = i[Math.min(s - 1, o)],
              e = i[Math.min(s - 1, Math.max(0, Math.floor(a) - 1))],
              n = (o - (a - 70)) / 70;
            return [
              t[0] + (e[0] - t[0]) * n * n,
              t[1] + (e[1] - t[1]) * n * n,
              1,
              n > 0.82 ? 1 : n > 0.45 ? 2 : -1,
              1.9 + 0.8 * n,
            ];
          }
          return c ? c(t, e) : [g[t].x, g[t].y, 0.3, -1, 1];
        };
      return ((h.box = o.box), h);
    },
    sphere(t, e) {
      const n = e.x + e.w / 2,
        o = e.y + e.h / 2,
        a = 0.42 * Math.min(e.w, e.h),
        r = "ring" === t ? Math.floor(0.2 * f) : 0;
      return (t, e) => {
        if (t < r) {
          const i = (t / r) * Math.PI * 2 + 0.35 * e,
            s = Math.cos(i) * a * 1.55,
            c = Math.sin(i) * a * 0.38;
          return [
            n + (s * Math.cos(-0.32) - c * Math.sin(-0.32)),
            o + (s * Math.sin(-0.32) + c * Math.cos(-0.32)),
            0.95,
            1,
            1.6,
          ];
        }
        const i = t - r + 0.5,
          s = Math.acos(1 - (2 * i) / (f - r)),
          c = 10.166407384630519 * i;
        let l = Math.sin(s) * Math.cos(c),
          h = Math.cos(s),
          d = Math.sin(s) * Math.sin(c);
        const u = 0.22 * e + 0.7 * y.nx,
          m = 0.35 + 0.35 * y.ny;
        let g = l * Math.cos(u) - d * Math.sin(u),
          p = l * Math.sin(u) + d * Math.cos(u),
          M = h * Math.cos(m) - p * Math.sin(m),
          x = h * Math.sin(m) + p * Math.cos(m);
        const v = 1 / (1.9 - 0.5 * x);
        return [
          n + g * a * v * 1.5,
          o + M * a * v * 1.5,
          0.25 + 0.75 * (0.5 * x + 0.5),
          -1,
          1 + 0.9 * x,
        ];
      };
    },
    helix(t, e) {
      const n = e.x + e.w / 2,
        o = 0.28 * Math.min(e.w, e.h);
      return (t, a) => {
        const r = t % 3,
          i = (t / f + 0.03 * a) % 1,
          s = e.y + e.h * (1 - i);
        if (2 === r) {
          const r = (0.618 * t) % 1;
          return [
            n +
              o *
                Math.cos((Math.floor(40 * i) / 40) * Math.PI * 16 + 1.1 * a) *
                (2 * r - 1),
            e.y + e.h * (1 - Math.floor(40 * i) / 40),
            0.45,
            2,
            1.1,
          ];
        }
        const c = i * Math.PI * 16 + 1.1 * a + r * Math.PI,
          l = Math.sin(c);
        return [
          n + o * Math.cos(c) * (1 + 0.6 * i),
          s,
          0.35 + 0.65 * (0.5 * l + 0.5),
          r ? 1 : 0,
          1.1 + 0.8 * l,
        ];
      };
    },
    towers(t, e) {
      const n = Array.from(
        { length: 36 },
        (t, e) =>
          0.25 + ((((43758.5453 * Math.sin(12.9898 * e)) % 1) + 1) % 1) * 0.75,
      );
      return (t, o) => {
        const a = t % 36,
          r = a % 9,
          i = Math.floor(a / 9),
          s = (0.381966 * t) % 1,
          c = s > 0.97;
        return [
          e.x +
            e.w * (0.08 + (r / 8) * 0.84) +
            (i - 1.5) * e.w * 0.035 +
            (e.w / 9) * 0.55 * (1 - 0.12 * i) * (((0.7548 * t) % 1) - 0.5),
          e.y +
            e.h * (0.95 - 0.06 * i) -
            s * (0.75 * e.h * n[a] * (0.9 + 0.1 * Math.sin(1.4 * o + a))),
          0.3 + 0.2 * i + (c ? 0.4 : 0),
          c && Math.sin(4 * o + a) > 0 ? 1 : 3 === i ? 2 : 0,
          1.3,
        ];
      };
    },
    flag(t, e) {
      const n = Math.ceil(f / 13);
      return (t, o) => {
        const a = t % 13,
          r = Math.floor(t / 13),
          i = r / n,
          s = i < 0.4 && a < 7,
          c = s && r % 3 == 0 && a % 2 == 0;
        return [
          e.x + i * e.w,
          e.y +
            0.08 * e.h +
            (a / 12) * e.h * 0.8 +
            (Math.sin(7 * i - 2.4 * o) * e.h * 0.05 * (i + 0.15) +
              Math.sin(3 * i - 1.1 * o) * e.h * 0.02),
          s ? (c ? 1 : 0.55) : 0.9,
          s ? (c ? 0 : 2) : a % 2 ? 0 : 1,
          1.6,
        ];
      };
    },
    scatter: () => (t, e) => {
      const n = g[t];
      return [
        ((n.hx * d + 8 * e * (n.r + 0.2)) % (d + 20)) - 10,
        n.hy * u + 8 * Math.sin(0.5 * e + 9 * n.r),
        0.28 * n.r + 0.08,
        -1,
        1 + n.r,
      ];
    },
  };
  function $(t) {
    if (!t || t === v) return;
    v = t;
    const [e, n = "right"] = t.split(";"),
      [o, a] = e.split(":"),
      r = (function (t) {
        const e = d >= 900;
        if ("hero" === t || "hero2" === t) {
          if (e && "hero" === t)
            return {
              x: 0.04 * d,
              y: 0.1 * u,
              w: 0.92 * d,
              h: 0.6 * u,
            };
          if (e) {
            const t = document.querySelector(".hero h1"),
              e = 72,
              n = t ? t.getBoundingClientRect().top + scrollY : 0.62 * u;
            return {
              x: 0.04 * d,
              y: e,
              w: 0.92 * d,
              h: Math.max(0.3 * u, n - e),
              fit: 0.86,
              fitH: 0.8,
            };
          }
          const n = document.querySelector(".hero h1"),
            o = 64,
            a = n ? n.getBoundingClientRect().top + scrollY - 18 : 0.5 * u;
          return {
            x: 0.02 * d,
            y: o,
            w: 0.96 * d,
            h: Math.max(0.25 * u, a - o),
            fit: 0.86,
            fitH: 0.94,
          };
        }
        if ("seal" === t) {
          const t = document.querySelector(".phero .col");
          if (!e) {
            const t = document.querySelector(".phero .tag"),
              e = 70,
              n = t ? t.getBoundingClientRect().top + scrollY - 22 : 0.4 * u;
            return {
              x: 0.08 * d,
              y: e,
              w: 0.84 * d,
              h: Math.max(140, n - e),
            };
          }
          if (t) {
            const e = t.getBoundingClientRect(),
              n = e.top + scrollY,
              o = e.bottom + scrollY,
              a = Math.min(0.56 * u, Math.max(0.46 * u, o - n));
            return {
              x: 0.52 * d,
              y: Math.max(84, (n + o) / 2 - 0.03 * u - a / 2),
              w: 0.36 * d,
              h: a,
            };
          }
        }
        return "logo" === t || "seal" === t
          ? e
            ? {
                x: 0.54 * d,
                y: 0.17 * u,
                w: 0.4 * d,
                h: 0.5 * u,
              }
            : {
                x: 0.06 * d,
                y: 0.1 * u,
                w: 0.88 * d,
                h: 0.3 * u,
              }
          : e
            ? {
                x: 0.52 * d,
                y: 0.14 * u,
                w: 0.42 * d,
                h: 0.72 * u,
              }
            : {
                x: 0.08 * d,
                y: 0.1 * u,
                w: 0.84 * d,
                h: 0.5 * u,
              };
      })(n);
    ((x = (T[o] || T.scatter)(a, r)),
      x.box && (C[t] = x.box),
      (w = d < 900 && "right" === n ? 0.4 : 1),
      "scatter" === o && (w = 1),
      redrawScene());
  }
  function R(timestamp) {
    particleFrame = 0;
    if (!particleBooted || document.hidden) return;
    E = n ? 0 : timestamp / 1e3;
    h.clearRect(0, 0, d, u);
    if (n) b = w * L;
    else b += 0.12 * (w * L - b);
    if (n) M.length = 0;
    else M = M.filter((wave) => (wave.r += 16) < 1.2 * Math.max(d, u));
    const radius = 120,
      spring = n ? 0.2 : 0.045;
    maxDisplacement = 0;
    peakVelocity = 0;
    for (let index = 0; index < f; index++) {
      const particle = g[index],
        target = x ? x(index, n ? 0 : E) : [particle.x, particle.y, 0.3, -1, 1];
      const tension = target[5] || spring;
      if (n) {
        particle.x = target[0];
        particle.y = target[1];
        particle.vx = particle.vy = 0;
      }
      let forceX = (target[0] - particle.x) * tension,
        forceY = (target[1] - particle.y) * tension;
      const pointerX = particle.x - y.x,
        pointerY = particle.y - y.y;
      const distanceSquared = pointerX * pointerX + pointerY * pointerY;
      if (distanceSquared < radius * radius) {
        const distance = Math.sqrt(distanceSquared) || 1,
          strength = ((radius - distance) / radius) * 5;
        forceX += (pointerX / distance) * strength;
        forceY += (pointerY / distance) * strength;
      }
      for (const wave of M) {
        const dx = particle.x - wave.x,
          dy = particle.y - wave.y,
          distance = Math.hypot(dx, dy) || 1;
        if (Math.abs(distance - wave.r) < 26) {
          forceX += (dx / distance) * 10;
          forceY += (dy / distance) * 10;
        }
      }
      if (n) {
        particle.x += forceX * 3;
        particle.y += forceY * 3;
      } else {
        particle.vx = 0.84 * (particle.vx + forceX);
        particle.vy = 0.84 * (particle.vy + forceY);
        particle.x += particle.vx;
        particle.y += particle.vy;
      }
      const velocity = Math.hypot(particle.vx, particle.vy);
      peakVelocity = Math.max(peakVelocity, velocity);
      maxDisplacement = Math.max(
        maxDisplacement,
        Math.hypot(particle.x - target[0], particle.y - target[1]),
      );
      const energy = Math.min(1, velocity / 7);
      const color = energy > 0.35 ? 1 : target[3] >= 0 ? target[3] : particle.c;
      h.globalAlpha = i(target[2] * b + 0.4 * energy, 0, 1);
      h.fillStyle = p[color];
      const size = target[4] * (d < 700 ? 1.1 : 1.35) + 2 * energy;
      h.fillRect(particle.x - size / 2, particle.y - size / 2, size, size);
    }
    h.globalAlpha = 1;
    particleFrames++;
    particleReady = true;
    if (n || particleFrames % 20 === 0 || particleFrames === 1)
      syncParticleMetrics();
    if (!n && !document.hidden) particleFrame = requestVisibleFrame(R);
  }
  let k;
  (addEventListener(
    "pointermove",
    (t) => {
      ((y.x = t.clientX),
        (y.y = t.clientY),
        (y.nx = (t.clientX / d) * 2 - 1),
        (y.ny = (t.clientY / u) * 2 - 1),
        n && redrawScene());
    },
    { passive: !0 },
  ),
    document.addEventListener("pointerleave", () => {
      ((y.x = y.y = -9999), n && redrawScene());
    }),
    addEventListener("pointerdown", (t) => {
      (t.target.closest("a,button,input") ||
        n ||
        M.push({
          x: t.clientX,
          y: t.clientY,
          r: 0,
        }),
        redrawScene());
    }),
    addEventListener("resize", () => {
      (clearTimeout(k),
        (k = setTimeout(() => {
          I.clear();
          for (const t in C) delete C[t];
          P();
          const t = v;
          ((v = ""), $(t), F());
        }, 160)));
    }));
  const B = {
    benve: { label: "BENVE", menu: "BENVE" },
    "": {
      label: "Home",
      menu: "Home",
      mount() {
        const t = r("#w1 span"),
          e = a("#w1"),
          o = a("#pillars"),
          s = r("#pillarUI article"),
          c = r("#pillarUI .progress b"),
          l = a("#mq");
        let h = 0,
          d = scrollY,
          u = 0,
          m = 0,
          f = !0;
        !(function t() {
          if (!f) return;
          if (n) {
            motionPausedFrames.add(t);
            return;
          }
          const e = scrollY - d;
          ((d = scrollY),
            (u += 0.1 * (e - u)),
            (h -= 1 + 0.6 * Math.abs(u)),
            (m += 0.1 * (i(0.4 * u, -12, 12) - m)));
          const o = l.scrollWidth / 3;
          (-h > o && (h += o),
            (l.style.transform = `translateX(${h}px) skewX(${-m}deg)`),
            n || requestVisibleFrame(t));
        })();
        const g = a("#ninety");
        let p = !1;
        const y = a(".hero");
        a("#toInits").addEventListener("click", (t) => {
          (t.preventDefault(),
            a("#initiatives").scrollIntoView({
              behavior: n ? "auto" : "smooth",
            }));
        });
        const M = "text:SI;hero",
          x = "snake:Super|Intelligence;hero2";
        let b = !1;
        const w = (t, e) => {
            (t !== b || e) &&
              ((b = t),
              (y.dataset.form = t
                ? innerWidth < 900
                  ? "circle:SUPER INTELLIGENCE ;hero"
                  : x
                : M),
              y.getBoundingClientRect().bottom > 0.3 * innerHeight &&
                ((v = ""), $(y.dataset.form)));
          },
          E = (t, e, n, o) =>
            t && e > t.x0 - o && e < t.x1 + o && n > t.y0 - o && n < t.y1 + o,
          L = (t) => {
            if (
              "touch" === t.pointerType ||
              document.body.classList.contains("menu-open")
            )
              return;
            if (y.getBoundingClientRect().bottom < 0.5 * innerHeight) return;
            const e = y.getBoundingClientRect();
            w(
              !(t.clientY > e.bottom) &&
                (b
                  ? E(C[x], t.clientX, t.clientY, 60)
                  : E(C[M], t.clientX, t.clientY, 20)),
            );
          };
        let P = null;
        return (
          addEventListener("pointermove", L, { passive: !0 }),
          y.addEventListener(
            "touchstart",
            (t) => {
              const e = t.touches[0];
              P = t.target.closest("a,button")
                ? null
                : {
                    x: e.clientX,
                    y: e.clientY,
                    at: performance.now(),
                  };
            },
            { passive: !0 },
          ),
          y.addEventListener(
            "touchend",
            (t) => {
              if (!P) return;
              const e = t.changedTouches[0],
                n = Math.hypot(e.clientX - P.x, e.clientY - P.y),
                o = performance.now() - P.at < 600;
              ((P = null), n < 12 && o && w(!b, !0));
            },
            { passive: !0 },
          ),
          {
            scroll() {
              const a = e.getBoundingClientRect(),
                r = i(
                  (0.85 * innerHeight - a.top) /
                    (a.height + 0.35 * innerHeight),
                  0,
                  1,
                );
              t.forEach((e, n) => e.classList.toggle("on", n / t.length < r));
              const l = o.getBoundingClientRect(),
                h = i(-l.top / (l.height - innerHeight), 0, 0.9999),
                d = Math.floor(3 * h);
              (s.forEach((t, e) => t.classList.toggle("on", e === d)),
                c.forEach(
                  (t, e) =>
                    (t.style.transform = `scaleX(${i(3 * h - e, 0, 1)})`),
                ),
                !p &&
                  g.getBoundingClientRect().top < 0.8 * innerHeight &&
                  ((p = !0),
                  (function (t, e, o = "") {
                    if (n) return void (t.textContent = e + o);
                    const a = performance.now(),
                      r = (n) => {
                        const s = i((n - a) / 1400, 0, 1);
                        ((t.textContent =
                          Math.round(e * (1 - Math.pow(1 - s, 4))) +
                          (1 === s ? o : "")),
                          s < 1 && requestVisibleFrame(r));
                      };
                    requestVisibleFrame(r);
                  })(g, 13, "")));
            },
            destroy() {
              ((f = !1), removeEventListener("pointermove", L));
            },
          }
        );
      },
    },
    education: {
      label: "Education",
      menu: "Education",
      mount() {
        const t = [
            [
              "Director of the Office of Science and Technology Policy",
              "Chair",
            ],
            ["Secretary of Agriculture", "Member"],
            ["Secretary of Labor", "Member"],
            ["Secretary of Education", "Member"],
            ["Secretary of Energy", "Member"],
            ["Director of the National Science Foundation", "Member"],
            ["Assistant to the President for Domestic Policy", "Member"],
            ["Special Advisor for SI & Crypto", "Member"],
            ["Assistant to the President for Policy", "Member"],
            [
              "Assistant to the President for the Office of the First Lady",
              "Member",
            ],
          ],
          e = [
            "OSTP Director",
            "Agriculture",
            "Labor",
            "Education",
            "Energy",
            "NSF Director",
            "Domestic Policy",
            "SI & Crypto",
            "Policy",
            "Office of the First Lady",
          ],
          n = a("#ring"),
          o = a("#memName"),
          i = a("#memRole");
        t.forEach((a, s) => {
          const c = (s / t.length) * Math.PI * 2 - Math.PI / 2,
            l = document.createElement("button");
          ((l.style.left = 50 + 50 * Math.cos(c) + "%"),
            (l.style.top = 50 + 50 * Math.sin(c) + "%"),
            (l.innerHTML = `<span style="transition-delay:${0.07 * s}s">${e[s]}</span>`),
            l.setAttribute("aria-label", a[0]));
          const h = () => {
            (r("button", n).forEach((t) => t.classList.remove("on")),
              l.classList.add("on"),
              (o.textContent = a[0]),
              (i.textContent = a[1]));
          };
          (l.addEventListener("pointerenter", h),
            l.addEventListener("focus", h),
            l.addEventListener("click", h),
            s || l.classList.add("on"),
            n.appendChild(l));
        });
      },
    },
    challenge: {
      label: "Presidential Challenge",
      menu: "Presidential Challenge",
      mount() {
        const t = a("#video"),
          e = (e) => {
            t &&
              /youtube/.test(e.blockedURI || "") &&
              (t.innerHTML =
                '<a class="vfall" href="https://youtu.be/FozZvEv8U9w" target="_blank" rel="noopener"><span class="play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg></span><span class="vcap"><b>A message from the First Lady</b><small>Watch on YouTube</small></span></a>');
          };
        return (
          document.addEventListener("securitypolicyviolation", e),
          {
            destroy() {
              document.removeEventListener("securitypolicyviolation", e);
            },
          }
        );
      },
    },
  };
  let A,
    q = null,
    H = null;
  function F() {
    if (a("body").classList.contains("menu-open")) return;
    const t = 0.5 * innerHeight;
    let e = null,
      n = 1 / 0;
    (r("[data-form]", a("#view") || document).forEach((o) => {
      const a = o.getBoundingClientRect();
      a.top <= t && a.bottom > t && a.height < n && ((e = o), (n = a.height));
    }),
      e &&
        $(
          e.dataset.form.includes(";")
            ? e.dataset.form
            : e.dataset.form + ";right",
        ));
    let o = null;
    (r("[data-dot]").forEach((e) => {
      const n = e.getBoundingClientRect();
      n.top <= t && n.bottom > t && (o = e.id);
    }),
      r("#dots a").forEach((t) => t.classList.toggle("on", t.dataset.t === o)));
    const s = document.querySelector("footer").getBoundingClientRect().top;
    ((L = i((s - 0.35 * innerHeight) / (0.55 * innerHeight), 0, 1)),
      H && H.scroll && H.scroll(),
      redrawScene());
  }
  addEventListener("scroll", F, { passive: !0 });
  const D = a("#view"),
    Y = a("#menuList"),
    O = {
      benve: "/benve",
      "": "/",
      education: "/initiatives/education",
      challenge: "/initiatives/presidential-challenge",
    },
    X = {
      "": "text:SI",
      education: "image:school",
      challenge: "image:seal",
    },
    _ = (t) => t.replace(/\/+$/, "") || "/",
    N = _(location.pathname);
  ((Y.innerHTML = ["", "education", "challenge"]
    .map(
      (t, e) =>
        `<li><a href="${O[t]}" style="--i:${e}" data-id="${t}"${O[t] === N ? ' aria-current="page"' : ""}>${B[t].menu}<small>0${e + 1}</small></a></li>`,
    )
    .join("")),
    r("a", Y).forEach((t) =>
      t.addEventListener("pointerenter", () => $(X[t.dataset.id] + ";right")),
    ));
  let W = null;
  document.addEventListener(
    "click",
    (t) => {
      W = {
        x: t.clientX,
        y: t.clientY,
      };
    },
    !0,
  );
  const U = a("#iris");
  (document.addEventListener("click", (t) => {
    const e = t.target.closest("a[href]");
    if (
      !e ||
      t.defaultPrevented ||
      "_blank" === e.target ||
      t.metaKey ||
      t.ctrlKey ||
      t.shiftKey ||
      t.altKey
    )
      return;
    const o = new URL(e.href, location.href);
    if (o.origin !== location.origin) return;
    const r = _(o.pathname);
    if (r === N)
      return void (
        o.hash ||
        (t.preventDefault(),
        z(),
        scrollTo({
          top: 0,
          behavior: n ? "auto" : "smooth",
        }))
      );
    (t.preventDefault(), z());
    const i = Object.keys(O).find((t) => O[t] === r),
      s = void 0 !== i ? B[i].label : "";
    if (n) return void (location.href = o.href);
    const c = W || {
      x: innerWidth / 2,
      y: innerHeight / 2,
    };
    (U.style.setProperty("--x", c.x + "px"),
      U.style.setProperty("--y", c.y + "px"),
      (a("#irisTxt").textContent = s),
      M.push({
        x: c.x,
        y: c.y,
        r: 0,
      }),
      U.classList.add("on"));
    try {
      sessionStorage.setItem("si-iris", s);
    } catch (t) {}
    setTimeout(() => {
      location.href = o.href;
    }, 650);
  }),
    addEventListener("pageshow", (t) => {
      t.persisted &&
        ((U.style.transition = "none"),
        U.classList.remove("on"),
        document.documentElement.classList.remove("irising"),
        requestVisibleFrame(() => {
          U.style.transition = "";
        }));
    }));
  const j = a("#orb");
  function z() {
    document.body.classList.contains("menu-open") &&
      (document.body.classList.remove("menu-open"),
      j.setAttribute("aria-expanded", "false"),
      (a("#orbTxt").textContent = "Menu"),
      (v = ""),
      F());
  }
  if (
    (j.addEventListener("click", () =>
      document.body.classList.contains("menu-open")
        ? (z(), j.focus())
        : (document.body.classList.add("menu-open"),
          j.setAttribute("aria-expanded", "true"),
          (a("#orbTxt").textContent = "Close"),
          $(
            {
              "": "text:SI",
              education: "image:school",
              challenge: "image:seal",
            }[q] + ";right",
          ),
          void (a("a[aria-current]", Y) || a("a", Y)).focus()),
    ),
    addEventListener("keydown", (t) => {
      "Escape" === t.key && z();
    }),
    o)
  ) {
    const t = a("#cursor");
    t.style.display = motionQuery.matches ? "none" : "";
    let e = -100,
      n = -100,
      o = -100,
      r = -100;
    (addEventListener(
      "pointermove",
      (t) => {
        ((o = t.clientX), (r = t.clientY));
      },
      { passive: !0 },
    ),
      document.addEventListener("pointerover", (e) =>
        t.classList.toggle("big", !!e.target.closest("a,button,[role=tab]")),
      ),
      (function a() {
        if (motionQuery.matches) {
          motionPausedFrames.add(a);
          return;
        }
        ((e += 0.2 * (o - e)),
          (n += 0.2 * (r - n)),
          (t.style.transform = `translate(${e}px,${n}px)`),
          requestVisibleFrame(a));
      })());
  } else a("#cursor").remove();
  (() => {
    const t = a(".giant"),
      e = `url(${a(".brand img").src}), radial-gradient(circle, #000 1.15px, transparent 1.75px)`;
    ((t.style.webkitMaskImage = e),
      (t.style.maskImage = e),
      (t.style.webkitMaskSize = t.style.maskSize = "100% 100%, 6px 6px"),
      (t.style.webkitMaskRepeat = t.style.maskRepeat = "no-repeat, repeat"),
      (t.style.webkitMaskComposite = "source-in"),
      (t.style.maskComposite = "intersect"));
  })();
  // This replica never transmits email addresses or injects subscription scripts.
  const G = a("#mc");
  if (G) {
    const email = a("#mcEmail"),
      message = a("#mcMsg");
    email.addEventListener("input", () => {
      message.textContent = "";
      message.className = "mmsg";
    });
    G.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = email.value.trim();
      message.className = "mmsg err";
      message.textContent = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        ? "Visit SI.gov to subscribe."
        : "Enter a valid email address.";
    });
  }
  (P(),
    (document.fonts && document.fonts.load
      ? Promise.race([
          document.fonts.load('400 100px "Instrument Serif"'),
          new Promise((t) => setTimeout(t, 1500)),
        ]).catch(() => {})
      : Promise.resolve()
    ).then(() => {
      ((function () {
        q = D && D.dataset.page in B ? D.dataset.page : "";
        for (
          let t = D && D.parentElement;
          t && t !== document.body;
          t = t.parentElement
        )
          t.style.setProperty("background", "transparent", "important");
        a("#plabel").textContent = B[q].label;
        let t = null;
        try {
          t = D && B[q].mount && B[q].mount();
        } catch (t) {}
        ((H = t && "object" == typeof t ? t : null),
          document.documentElement.classList.add("si-ready"),
          A && A.disconnect(),
          (A = new IntersectionObserver(
            (t) =>
              t.forEach((t) => {
                t.isIntersecting &&
                  (t.target.classList.add("in"), A.unobserve(t.target));
              }),
            { threshold: 0.15 },
          )),
          r(".reveal, .fade, .pop").forEach((t) =>
            n ? t.classList.add("in") : A.observe(t),
          ),
          r(".init").forEach((t) =>
            t.addEventListener("pointermove", (e) => {
              const n = t.getBoundingClientRect();
              (t.style.setProperty("--mx", e.clientX - n.left + "px"),
                t.style.setProperty("--my", e.clientY - n.top + "px"));
            }),
          ),
          (function () {
            const t = a("#dots"),
              e = r("[data-dot]");
            (e.forEach((t, e) => (t.id = t.id || "sec" + e)),
              (t.innerHTML = e
                .map(
                  (t) =>
                    `<a href="#${t.id}" data-t="${t.id}"><span>${t.dataset.dot}</span><i></i></a>`,
                )
                .join("")),
              r("a", t).forEach((t) =>
                t.addEventListener("click", (e) => {
                  (e.preventDefault(),
                    document
                      .getElementById(t.dataset.t)
                      .scrollIntoView({ behavior: n ? "auto" : "smooth" }));
                }),
              ));
          })(),
          (v = ""),
          F());
      })(),
        (particleBooted = true),
        redrawScene(),
        (function () {
          const t = document.documentElement;
          let e = "";
          try {
            ((e = sessionStorage.getItem("si-iris") || ""),
              sessionStorage.removeItem("si-iris"));
          } catch (t) {}
          t.classList.contains("irising") &&
            ((a("#irisTxt").textContent = e),
            (U.style.transition = "none"),
            U.style.setProperty("--x", "50%"),
            U.style.setProperty("--y", "50%"),
            U.classList.add("on"),
            t.classList.remove("irising"),
            requestVisibleFrame(() => {
              ((U.style.transition = ""),
                U.classList.remove("on"),
                M.push({
                  x: innerWidth / 2,
                  y: innerHeight / 2,
                  r: 0,
                }));
            }));
        })());
    }));
};
"loading" === document.readyState
  ? document.addEventListener("DOMContentLoaded", __si)
  : __si();
