import { test, expect } from "@playwright/test";

const errorsByPage = new WeakMap();
const order = ["logo", "word", "dress", "dress-two"];

test.beforeEach(async ({ page }) => {
  const errors = [];
  errorsByPage.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
});

test.afterEach(async ({ page }) => {
  expect(errorsByPage.get(page), "BENVE should not produce uncaught JavaScript errors").toEqual([]);
});

const scene = (page) => page.evaluate(() => window.__benveScene.getState());

async function waitForCloud(page) {
  const canvas = page.locator("#benve-canvas");
  await expect(canvas).toHaveAttribute("data-particle-ready", "true");
  await expect(canvas).toHaveAttribute("data-particle-frames", /^[1-9]\d*$/);
  await expect(canvas).toBeVisible();
}

async function openCloud(page, path = "/benve/") {
  await page.goto(path);
  await waitForCloud(page);
}

async function anchor(page, shape) {
  return page.locator(`[data-particle-anchor="${shape}"]`).evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  });
}

async function showShape(page, shape) {
  await page.locator(`[data-particle-scene="${shape}"]`).evaluate((element) => {
    window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top, behavior: "instant" });
  });
  await expect.poll(async () => (await scene(page)).shape).toBe(shape);
  await expect.poll(async () => (await scene(page)).scroll.progress).toBeCloseTo(order.indexOf(shape), 2);
  await expect.poll(async () => (await scene(page)).maxDisplacement).toBeLessThan(6);
}

async function showMiddle(page, from, to) {
  const top = await page.evaluate(([first, second]) => {
    const firstBounds = document.querySelector(`[data-particle-scene="${first}"]`).getBoundingClientRect();
    const secondBounds = document.querySelector(`[data-particle-scene="${second}"]`).getBoundingClientRect();
    return window.scrollY + (firstBounds.top + secondBounds.top) / 2;
  }, [from, to]);
  await page.evaluate((scrollTop) => window.scrollTo({ top: scrollTop, behavior: "instant" }), top);
  await expect.poll(async () => (await scene(page)).scroll.from).toBe(from);
  await expect.poll(async () => (await scene(page)).scroll.to).toBe(to);
  await expect.poll(async () => (await scene(page)).scroll.mix).toBeGreaterThan(0.35);
  await expect.poll(async () => (await scene(page)).scroll.mix).toBeLessThan(0.65);
  await expect.poll(async () => (await scene(page)).maxDisplacement).toBeLessThan(6);
}

async function pixels(page) {
  return page.locator("#benve-canvas").evaluate((canvas) => {
    const { width, height } = canvas;
    const state = window.__benveScene.getState();
    const bounds = canvas.getBoundingClientRect();
    const centerX = (state.center.x - bounds.left) * state.size.dpr;
    const centerY = (state.center.y - bounds.top) * state.size.dpr;
    const holeRadiusSquared = (state.size.diameter * state.size.dpr * 0.18) ** 2;
    const data = canvas.getContext("2d").getImageData(0, 0, width, height).data;
    let drawn = 0;
    let centerDrawn = 0;
    let offWhite = 0;
    let offPalette = 0;
    const paletteOutliers = [];
    const colors = { white: 0, lavender: 0, periwinkle: 0 };
    let sumX = 0;
    let sumY = 0;
    const quadrants = [0, 0, 0, 0];
    let hash = 2166136261;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let offset = 0; offset < data.length; offset += 4) {
      hash = Math.imul(hash ^ data[offset + 3], 16777619) >>> 0;
      if (data[offset + 3] < 60) continue;
      drawn++;
      const [red, green, blue] = [data[offset], data[offset + 1], data[offset + 2]];
      if (red < 245 || green < 245 || blue < 245) offWhite++;
      else colors.white++;
      // The two opaque dress tints may blend toward white during the morph.
      if (red < 169 || green < 186 || blue < 245) {
        offPalette++;
        if (paletteOutliers.length < 10) paletteOutliers.push({ rgba: [red, green, blue, data[offset + 3]], x: offset / 4 % width, y: Math.floor(offset / 4 / width) });
      }
      if (Math.abs(red - 222) <= 8 && Math.abs(green - 214) <= 8 && blue >= 247) colors.lavender++;
      if (Math.abs(red - 174) <= 8 && Math.abs(green - 191) <= 8 && blue >= 247) colors.periwinkle++;
      const position = offset / 4;
      const x = position % width;
      const y = Math.floor(position / width);
      sumX += x;
      sumY += y;
      quadrants[(x >= centerX ? 1 : 0) + (y >= centerY ? 2 : 0)]++;
      if ((x - centerX) ** 2 + (y - centerY) ** 2 < holeRadiusSquared) centerDrawn++;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    return {
      drawn, centerDrawn, offWhite, offPalette, paletteOutliers, colors, quadrants, hash, width, height,
      figureWidth: (maxX - minX + 1) / state.size.dpr,
      figureHeight: (maxY - minY + 1) / state.size.dpr,
      bounds: { left: bounds.left + minX / state.size.dpr, right: bounds.left + maxX / state.size.dpr, top: bounds.top + minY / state.size.dpr, bottom: bounds.top + maxY / state.size.dpr },
      centroid: { x: bounds.left + sumX / drawn / state.size.dpr, y: bounds.top + sumY / drawn / state.size.dpr },
    };
  });
}

async function moveOnLogo(page) {
  const state = await scene(page);
  const diameter = state.size.diameter;
  const point = { x: state.center.x + diameter * 0.39, y: state.center.y - diameter * 0.15 };
  await page.mouse.move(point.x, point.y, { steps: 8 });
  return point;
}

test("BENVE loads locally with its exact brand, a fixed canvas, and white circular lettering on blue", async ({ page }) => {
  const externalRequests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== "http://127.0.0.1:5173") externalRequests.push(request.url());
  });
  await openCloud(page, "/benve");
  await expect(page).toHaveURL(/\/benve\/$/);
  await expect(page).toHaveTitle("BENVE — vestidos de fiesta");
  await expect(page.locator("body")).not.toContainText(/bembe/i);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(23, 74, 245)");
  await expect(page.locator("html")).toHaveCSS("background-color", "rgb(23, 74, 245)");
  await expect(page.locator(".benve-stage")).toHaveCSS("position", "fixed");
  const logoPanel = page.locator('[data-particle-scene="logo"]');
  const heading = logoPanel.getByRole("heading", { name: "BENVE", exact: true });
  const description = logoPanel.getByText("vestidos de fiesta", { exact: true });
  await expect(heading).toBeVisible();
  await expect(description).toBeVisible();
  const titleBounds = await heading.boundingBox();
  const logoAnchor = await anchor(page, "logo");
  expect(titleBounds.x + titleBounds.width).toBeLessThanOrEqual(logoAnchor.x + 1);
  await expect.poll(async () => (await scene(page)).maxDisplacement).toBeLessThan(6);
  const state = await scene(page);
  expect(state.shape).toBe("logo");
  expect(state.scroll.total).toBe(3);
  expect(state.count).toBeGreaterThan(1500);
  expect(state.color).toBe("#ffffff");
  expect(state.palette).toEqual(["#ffffff"]);
  expect(state.dressWeight).toBe(0);
  expect(state.center.x).toBeGreaterThan(state.size.width * 0.55);
  const image = await pixels(page);
  expect(image.drawn).toBeGreaterThan(2000);
  expect(image.offWhite).toBe(0);
  expect(image.centerDrawn).toBe(0);
  for (const region of image.quadrants) expect(region).toBeGreaterThan(200);
  expect(image.figureWidth).toBeGreaterThan(state.size.diameter * 0.7);
  expect(image.figureHeight).toBeGreaterThan(state.size.diameter * 0.7);
  expect(externalRequests).toEqual([]);
});

test("the circular logo rotates continuously around a stable center and is drawn as points", async ({ page }) => {
  await page.addInitScript(() => {
    window.__benveDrawingProbe = { imageDraws: 0, points: 0 };
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    const arc = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.drawImage = function (...args) {
      if (this.canvas.id === "benve-canvas") window.__benveDrawingProbe.imageDraws++;
      return Reflect.apply(drawImage, this, args);
    };
    CanvasRenderingContext2D.prototype.arc = function (...args) {
      if (this.canvas.id === "benve-canvas") window.__benveDrawingProbe.points++;
      return Reflect.apply(arc, this, args);
    };
  });
  await openCloud(page);
  await expect.poll(async () => (await scene(page)).maxDisplacement).toBeLessThan(6);
  const initial = await scene(page);
  const image = await pixels(page);
  await expect.poll(async () => (await scene(page)).frames).toBeGreaterThan(initial.frames + 50);
  const rotated = await scene(page);
  const changed = await pixels(page);
  expect(rotated.rotation.z).toBeGreaterThan(initial.rotation.z + 0.03);
  expect(rotated.center.x).toBeCloseTo(initial.center.x, 1);
  expect(rotated.center.y).toBeCloseTo(initial.center.y, 1);
  expect(Math.hypot(changed.centroid.x - image.centroid.x, changed.centroid.y - image.centroid.y)).toBeLessThan(4);
  expect(changed.hash).not.toBe(image.hash);
  const draws = await page.evaluate(() => window.__benveDrawingProbe);
  expect(draws.imageDraws).toBe(0);
  expect(draws.points).toBeGreaterThan(initial.count * 20);
});

test("scroll morphs the same cloud through BENVE and two distinct dresses on opposite sides", async ({ page }) => {
  await openCloud(page);
  const initial = await scene(page);
  const fingerprints = new Set([(await pixels(page)).hash]);
  await showMiddle(page, "logo", "word");
  const middle = await scene(page);
  expect(middle.count).toBe(initial.count);
  expect(middle.scroll.progress).toBeCloseTo(0.5, 2);
  expect(middle.center.x).toBeLessThan(initial.center.x);
  const logoWordImage = await pixels(page);
  expect(logoWordImage.offWhite).toBe(0);
  fingerprints.add(logoWordImage.hash);
  await showShape(page, "word");
  const word = await scene(page);
  const wordImage = await pixels(page);
  expect(word.count).toBe(initial.count);
  expect(word.dressWeight).toBe(0);
  expect(word.palette).toEqual(["#ffffff"]);
  expect(word.center.x).toBeLessThan(word.size.width / 2);
  expect(middle.center.x).toBeGreaterThan(word.center.x);
  expect(wordImage.centroid.x).toBeLessThan(word.size.width / 2);
  expect(wordImage.figureWidth).toBeGreaterThan(wordImage.figureHeight * 2);
  expect(wordImage.drawn).toBeGreaterThan(1500);
  expect(wordImage.offWhite).toBe(0);
  fingerprints.add(wordImage.hash);
  await showMiddle(page, "word", "dress");
  const dressMiddle = await scene(page);
  expect(dressMiddle.count).toBe(initial.count);
  expect(dressMiddle.dressWeight).toBeGreaterThan(0.35);
  expect(dressMiddle.dressWeight).toBeLessThan(0.65);
  const wordDressImage = await pixels(page);
  expect(wordDressImage.offWhite).toBeGreaterThan(20);
  expect(wordDressImage.offPalette).toBe(0);
  fingerprints.add(wordDressImage.hash);
  await showShape(page, "dress");
  const dress = await scene(page);
  const dressImage = await pixels(page);
  expect(dress.count).toBe(initial.count);
  expect(dress.dressWeight).toBe(1);
  expect(dress.palette).toEqual(["#ffffff", "#ded6ff", "#aebfff"]);
  expect(dress.center.x).toBeLessThan(dress.size.width / 2);
  expect(dressImage.centroid.x).toBeLessThan(dress.size.width / 2);
  expect(dressImage.figureHeight).toBeGreaterThan(dressImage.figureWidth * 1.15);
  expect(dressImage.drawn).toBeGreaterThan(1500);
  expect(dressImage.offPalette).toBe(0);
  expect(dressImage.colors.white).toBeGreaterThan(100);
  expect(dressImage.colors.lavender).toBeGreaterThan(20);
  expect(dressImage.colors.periwinkle).toBeGreaterThan(20);
  fingerprints.add(dressImage.hash);
  await showMiddle(page, "dress", "dress-two");
  const dressesMiddle = await scene(page);
  const dressesMiddleImage = await pixels(page);
  expect(dressesMiddle.count).toBe(initial.count);
  expect(dressesMiddle.scroll.progress).toBeCloseTo(2.5, 2);
  expect(dressesMiddle.dressWeight).toBe(1);
  expect(dressesMiddleImage.offPalette).toBe(0);
  expect(dressesMiddleImage.offWhite).toBeGreaterThan(20);
  fingerprints.add(dressesMiddleImage.hash);
  await showShape(page, "dress-two");
  const dressTwo = await scene(page);
  const dressTwoImage = await pixels(page);
  expect(dressTwo.count).toBe(initial.count);
  expect(dressTwo.dressWeight).toBe(1);
  expect(dressTwo.palette).toEqual(["#ffffff", "#ded6ff", "#aebfff"]);
  expect(dressTwo.center.x).toBeGreaterThan(dressTwo.size.width / 2);
  expect(dressTwo.center.y).toBeGreaterThan(dress.center.y);
  expect(dressTwoImage.centroid.x).toBeGreaterThan(dressTwo.size.width / 2);
  expect(dressTwoImage.figureHeight).toBeGreaterThan(dressTwoImage.figureWidth * 1.15);
  expect(dressTwoImage.drawn).toBeGreaterThan(1500);
  expect(dressTwoImage.offPalette).toBe(0);
  expect(dressTwoImage.colors.white).toBeGreaterThan(100);
  expect(dressTwoImage.colors.lavender).toBeGreaterThan(20);
  expect(dressTwoImage.colors.periwinkle).toBeGreaterThan(20);
  fingerprints.add(dressTwoImage.hash);
  expect(fingerprints.size).toBe(7);
  const bounds = await page.locator("#benve-canvas").boundingBox();
  expect(bounds.x).toBe(0);
  expect(bounds.y).toBe(0);
  expect(bounds.width).toBe(dressTwo.size.width);
  expect(bounds.height).toBe(dressTwo.size.height);
  for (const shape of ["dress", "word", "logo"]) {
    await showShape(page, shape);
    const reversed = await scene(page);
    expect(reversed.count).toBe(initial.count);
    if (shape === "dress") {
      expect(reversed.dressWeight).toBe(1);
      expect(reversed.palette).toEqual(["#ffffff", "#ded6ff", "#aebfff"]);
      const reversedDress = await pixels(page);
      expect(reversedDress.offPalette).toBe(0);
      expect(reversedDress.colors.lavender).toBeGreaterThan(20);
      expect(reversedDress.colors.periwinkle).toBeGreaterThan(20);
    } else {
      expect(reversed.dressWeight).toBe(0);
      expect(reversed.palette).toEqual(["#ffffff"]);
      expect((await pixels(page)).offWhite).toBe(0);
    }
  }
});

test("BENVE remains readable while its word points respond to the mouse and return to their silhouette", async ({ page }) => {
  await openCloud(page);
  await showShape(page, "word");
  await expect.poll(async () => (await scene(page)).maxDisplacement).toBeLessThan(0.5);
  const initial = await scene(page);
  expect(initial.wordWeight).toBe(1);
  expect(initial.wordContainmentLimit).toBeGreaterThanOrEqual(2);
  expect(initial.wordContainmentLimit).toBeLessThanOrEqual(6);
  const before = await pixels(page);
  const inkPoint = await page.locator("#benve-canvas").evaluate((canvas) => {
    const state = window.__benveScene.getState();
    const bounds = canvas.getBoundingClientRect();
    const desiredX = state.center.x - state.targetBounds.width * 0.15;
    const desiredY = state.center.y;
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let closest = null;
    let distance = Infinity;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        if (data[(y * canvas.width + x) * 4 + 3] < 150) continue;
        const point = { x: bounds.left + x / state.size.dpr, y: bounds.top + y / state.size.dpr };
        const candidateDistance = (point.x - desiredX) ** 2 + (point.y - desiredY) ** 2;
        if (candidateDistance < distance) { closest = point; distance = candidateDistance; }
      }
    }
    return closest;
  });
  expect(inkPoint).not.toBeNull();
  await page.mouse.move(inkPoint.x, inkPoint.y, { steps: 8 });
  await expect.poll(async () => (await scene(page)).pointer.inside).toBe(true);
  await expect.poll(async () => (await scene(page)).maxDisplacement).toBeGreaterThan(0.2);
  const moved = await scene(page);
  const image = await pixels(page);
  expect(moved.shape).toBe("word");
  expect(moved.count).toBe(initial.count);
  expect(moved.maxDisplacement).toBeLessThanOrEqual(moved.wordContainmentLimit + 0.1);
  expect(image.hash).not.toBe(before.hash);
  expect(image.offWhite).toBe(0);
  expect(image.drawn).toBeGreaterThan(before.drawn * 0.75);
  expect(image.bounds.left).toBeGreaterThanOrEqual(before.bounds.left - 8);
  expect(image.bounds.right).toBeLessThanOrEqual(before.bounds.right + 8);
  expect(image.bounds.top).toBeGreaterThanOrEqual(before.bounds.top - 8);
  expect(image.bounds.bottom).toBeLessThanOrEqual(before.bounds.bottom + 8);
  await page.mouse.move(-10, -10);
  await expect.poll(async () => (await scene(page)).pointer.inside).toBe(false);
  await expect.poll(async () => (await scene(page)).maxDisplacement).toBeLessThan(0.5);
});

test("mouse movement visibly tilts and displaces points, which settle after leaving", async ({ page }) => {
  await openCloud(page);
  await expect.poll(async () => (await scene(page)).maxDisplacement).toBeLessThan(6);
  const before = await pixels(page);
  await moveOnLogo(page);
  await expect.poll(async () => (await scene(page)).pointer.inside).toBe(true);
  await expect.poll(async () => Math.abs((await scene(page)).rotation.y)).toBeGreaterThan(0.03);
  await expect.poll(async () => (await scene(page)).maxDisplacement).toBeGreaterThan(15);
  expect((await pixels(page)).hash).not.toBe(before.hash);
  await page.mouse.move(-10, -10);
  await expect.poll(async () => (await scene(page)).pointer.inside).toBe(false);
  await expect.poll(async () => (await scene(page)).maxDisplacement).toBeLessThan(6);
  await expect.poll(async () => Math.abs((await scene(page)).rotation.y)).toBeLessThan(0.005);
});

test("clicks and keyboard create waves while Recomponer preserves the selected scene", async ({ page }) => {
  await openCloud(page);
  const point = await moveOnLogo(page);
  await page.mouse.click(point.x, point.y);
  await expect.poll(async () => (await scene(page)).waves).toBeGreaterThan(0);
  await expect.poll(async () => (await scene(page)).maxDisplacement).toBeGreaterThan(20);
  await page.locator("#benve-reset").click();
  let reset = await scene(page);
  expect(reset.waves).toBe(0);
  expect(reset.pointer.inside).toBe(false);
  expect(reset.shape).toBe("logo");
  expect(Math.abs(reset.rotation.x)).toBeLessThan(0.005);
  expect(Math.abs(reset.rotation.y)).toBeLessThan(0.005);
  expect((await pixels(page)).centerDrawn).toBe(0);
  await showShape(page, "word");
  const selected = await scene(page);
  await page.locator("#benve-canvas").focus();
  await expect(page.locator("#benve-canvas")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await scene(page)).waves).toBeGreaterThan(0);
  await page.locator("#benve-reset").click();
  reset = await scene(page);
  expect(reset.waves).toBe(0);
  expect(reset.shape).toBe("word");
  expect(reset.scroll.progress).toBeCloseTo(selected.scroll.progress, 2);
  expect(reset.center.x).toBeCloseTo(selected.center.x, 1);
  expect(reset.center.y).toBeCloseTo(selected.center.y, 1);
  expect((await pixels(page)).drawn).toBeGreaterThan(1500);
});

test("the SI.gov menu opens BENVE and its back link returns to the original site", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#field")).toHaveAttribute("data-particle-ready", "true");
  await page.locator("#orb").click();
  await page.locator("#menu").getByRole("link", { name: "BENVE — logo interactivo", exact: true }).click();
  await expect(page).toHaveURL(/\/benve\/$/);
  await waitForCloud(page);
  await expect(page.getByRole("heading", { name: "BENVE", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Volver a SI.gov" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("#field")).toHaveAttribute("data-particle-ready", "true");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Super Intelligence");
});

for (const width of [390, 320]) {
  test.describe(`BENVE mobile ${width}px`, () => {
    test.use({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });

    test("fits the brand and all four scenes without overflow and responds to touch", async ({ page }) => {
      await openCloud(page);
      await expect.poll(async () => (await scene(page)).maxDisplacement).toBeLessThan(6);
      const heading = page.getByRole("heading", { name: "BENVE", exact: true });
      await expect(heading).toBeVisible();
      const headingGeometry = await heading.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(element);
        const text = range.getBoundingClientRect();
        return { bottom: bounds.bottom, textLeft: text.left, textRight: text.right };
      });
      expect(headingGeometry.textLeft).toBeGreaterThanOrEqual(0);
      expect(headingGeometry.textRight).toBeLessThanOrEqual(width);
      const logoAnchor = await anchor(page, "logo");
      expect(headingGeometry.bottom).toBeLessThanOrEqual(logoAnchor.y + 1);
      const initial = await scene(page);
      const logoImage = await pixels(page);
      expect(logoImage.drawn).toBeGreaterThan(1000);
      expect(logoImage.centerDrawn).toBe(0);
      expect(logoImage.offWhite).toBe(0);
      await page.touchscreen.tap(initial.center.x + initial.size.diameter * 0.35, initial.center.y);
      await expect.poll(async () => (await scene(page)).waves).toBeGreaterThan(0);
      await expect.poll(async () => (await scene(page)).pointer.inside).toBe(false);
      await page.locator("#benve-reset").tap();
      expect((await scene(page)).waves).toBe(0);
      for (const shape of ["word", "dress", "dress-two"]) {
        await showShape(page, shape);
        const current = await scene(page);
        const image = await pixels(page);
        expect(current.count).toBe(initial.count);
        expect(image.drawn).toBeGreaterThan(1000);
        if (shape.startsWith("dress")) {
          expect(image.offPalette, JSON.stringify(image.paletteOutliers)).toBe(0);
          expect(image.colors.lavender).toBeGreaterThan(20);
          expect(image.colors.periwinkle).toBeGreaterThan(20);
        } else expect(image.offWhite).toBe(0);
        expect(image.figureWidth).toBeLessThan(width);
        const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
      }
    });
  });
}

test.describe("BENVE reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("keeps every scene still while scroll, pointer, and keyboard preserve visible figures", async ({ page }) => {
    await openCloud(page);
    await page.waitForTimeout(100);
    const initial = await scene(page);
    expect(initial.reducedMotion).toBe(true);
    expect(initial.active).toBe(false);
    const original = await pixels(page);
    expect(original.drawn).toBeGreaterThan(2000);
    expect(original.offWhite).toBe(0);
    expect(original.centerDrawn).toBe(0);
    await page.waitForTimeout(400);
    expect((await scene(page)).frames).toBe(initial.frames);
    expect((await pixels(page)).hash).toBe(original.hash);
    await moveOnLogo(page);
    expect((await scene(page)).maxDisplacement).toBeGreaterThan(1);
    expect((await pixels(page)).hash).not.toBe(original.hash);
    await page.mouse.move(-10, -10);
    const fingerprints = new Set();
    for (const shape of order) {
      await showShape(page, shape);
      const current = await scene(page);
      const image = await pixels(page);
      expect(current.count).toBe(initial.count);
      expect(current.active).toBe(false);
      expect(image.drawn).toBeGreaterThan(1500);
      if (shape.startsWith("dress")) {
        expect(image.offPalette).toBe(0);
        expect(image.colors.lavender).toBeGreaterThan(20);
        expect(image.colors.periwinkle).toBeGreaterThan(20);
      } else expect(image.offWhite).toBe(0);
      fingerprints.add(image.hash);
      await page.waitForTimeout(200);
      expect((await scene(page)).frames).toBe(current.frames);
      expect((await pixels(page)).hash).toBe(image.hash);
    }
    expect(fingerprints.size).toBe(4);
    await page.locator("#benve-canvas").focus();
    await page.keyboard.press("Enter");
    expect((await scene(page)).waves).toBe(0);
    expect((await scene(page)).shape).toBe("dress-two");
    expect((await pixels(page)).drawn).toBeGreaterThan(1500);
    const afterKey = await scene(page);
    await page.waitForTimeout(300);
    expect((await scene(page)).frames).toBe(afterKey.frames);
  });
});

test("changing the motion preference pauses the cloud and resumes the full logo rotation", async ({ page }) => {
  await openCloud(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(async () => (await scene(page)).reducedMotion).toBe(true);
  await expect.poll(async () => (await scene(page)).active).toBe(false);
  await page.waitForTimeout(100);
  const paused = await scene(page);
  const image = await pixels(page);
  await page.waitForTimeout(400);
  expect((await scene(page)).frames).toBe(paused.frames);
  expect((await pixels(page)).hash).toBe(image.hash);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(async () => (await scene(page)).active).toBe(true);
  await expect.poll(async () => (await scene(page)).frames).toBeGreaterThan(paused.frames + 20);
  expect((await scene(page)).rotation.z).toBeGreaterThan(paused.rotation.z);
  expect((await pixels(page)).hash).not.toBe(image.hash);
});
