import { test, expect } from "@playwright/test";

const errorsByPage = new WeakMap();

test.beforeEach(async ({ page }) => {
  const errors = [];
  errorsByPage.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
});

test.afterEach(async ({ page }) => {
  expect(errorsByPage.get(page), "ATENEA should not produce uncaught JavaScript errors").toEqual([]);
});

const scene = (page) => page.evaluate(() => window.__ateneaScene.getState());

async function openLogo(page, path = "/atenea/") {
  await page.goto(path);
  const canvas = page.locator("#atenea-canvas");
  await expect(canvas).toHaveAttribute("data-particle-ready", "true");
  await expect(canvas).toHaveAttribute("data-particle-frames", /^[1-9]\d*$/);
  await expect(canvas).toBeVisible();
  await expect.poll(async () => (await scene(page)).maxDisplacement).toBeLessThan(0.3);
}

async function artwork(page) {
  return page.locator("#atenea-canvas").evaluate((canvas) => {
    const state = window.__ateneaScene.getState();
    const rect = canvas.getBoundingClientRect();
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    const regions = {
      symbol: [260, 149, 573, 515],
      aFirst: [166, 578, 252, 684],
      t: [258, 578, 315, 684],
      eFirst: [332, 578, 395, 684],
      n: [415, 578, 480, 684],
      eLast: [500, 578, 563, 684],
      aLast: [577, 578, 668, 684],
      separation: [166, 530, 668, 562],
      mainHole: [402, 345, 437, 384],
      firstHole: [208, 637, 216, 646],
      lastHole: [619, 637, 627, 646],
    };
    const occupancy = Object.fromEntries(Object.keys(regions).map((name) => [name, 0]));
    const navRects = [...document.querySelectorAll('.page-nav a')].map((link) => {
      const bounds = link.getBoundingClientRect();
      return { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom };
    });
    let drawn = 0, offGreen = 0, navigationOverlap = 0, hash = 2166136261;
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    let symbolLeft = Infinity, symbolRight = -Infinity, symbolTop = Infinity, symbolBottom = -Infinity;
    let wordLeft = Infinity, wordRight = -Infinity, wordTop = Infinity, wordBottom = -Infinity;
    let nearestDistance = Infinity, inkPoint = null;
    const greenOutliers = [];
    for (let offset = 0; offset < data.length; offset += 4) {
      hash = Math.imul(hash ^ data[offset + 3], 16777619) >>> 0;
      if (data[offset + 3] < 100) continue;
      drawn++;
      const [red, green, blue] = [data[offset], data[offset + 1], data[offset + 2]];
      // Unpremultiplication can move antialiased boundary channels by a few units.
      if (red > 8 || Math.abs(green - 204) > 8 || Math.abs(blue - 102) > 8) {
        offGreen++;
        if (greenOutliers.length < 8) greenOutliers.push([red, green, blue, data[offset + 3]]);
      }
      const x = (offset / 4 % canvas.width) / state.size.dpr;
      const y = Math.floor(offset / 4 / canvas.width) / state.size.dpr;
      const sourceX = state.sourceBounds.x + (x - state.bounds.x) / state.bounds.width * state.sourceBounds.width;
      const sourceY = state.sourceBounds.y + (y - state.bounds.y) / state.bounds.height * state.sourceBounds.height;
      for (const [name, region] of Object.entries(regions)) {
        if (sourceX >= region[0] && sourceX <= region[2] && sourceY >= region[1] && sourceY <= region[3]) occupancy[name]++;
      }
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
      if (sourceY < 535) {
        symbolLeft = Math.min(symbolLeft, x); symbolRight = Math.max(symbolRight, x);
        symbolTop = Math.min(symbolTop, y); symbolBottom = Math.max(symbolBottom, y);
      } else if (sourceY > 562) {
        wordLeft = Math.min(wordLeft, x); wordRight = Math.max(wordRight, x);
        wordTop = Math.min(wordTop, y); wordBottom = Math.max(wordBottom, y);
      }
      const distance = (sourceX - 300) ** 2 + (sourceY - 450) ** 2;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        inkPoint = { x: rect.left + x, y: rect.top + y };
      }
      const viewportX = rect.left + x, viewportY = rect.top + y;
      if (navRects.some((bounds) => viewportX > bounds.left + 1 && viewportX < bounds.right - 1 && viewportY > bounds.top + 1 && viewportY < bounds.bottom - 1)) navigationOverlap++;
    }
    return {
      drawn, offGreen, greenOutliers, hash, occupancy, navigationOverlap, inkPoint,
      width: right - left, height: bottom - top,
      bounds: { left: rect.left + left, right: rect.left + right, top: rect.top + top, bottom: rect.top + bottom },
      symbol: { width: symbolRight - symbolLeft, height: symbolBottom - symbolTop },
      word: { width: wordRight - wordLeft, height: wordBottom - wordTop },
    };
  });
}

function expectFaithfulArtwork(image, state) {
  expect(image.drawn).toBeGreaterThan(1200);
  expect(image.offGreen, JSON.stringify(image.greenOutliers)).toBe(0);
  expect(image.width / image.height).toBeGreaterThan(0.9);
  expect(image.width / image.height).toBeLessThan(0.99);
  expect(image.width / image.height).toBeCloseTo(state.sourceAspect, 1);
  expect(state.size.logoWidth / state.size.logoHeight).toBeCloseTo(state.sourceAspect, 5);
  // The source has one large mark above a much wider, shallower custom wordmark.
  expect(image.symbol.width / image.word.width).toBeGreaterThan(0.58);
  expect(image.symbol.width / image.word.width).toBeLessThan(0.67);
  expect(image.symbol.height / image.word.height).toBeGreaterThan(3.1);
  expect(image.symbol.height / image.word.height).toBeLessThan(3.7);
  for (const region of ["symbol", "aFirst", "t", "eFirst", "n", "eLast", "aLast"]) {
    expect(image.occupancy[region], `${region} should contain real green points`).toBeGreaterThan(30);
  }
  for (const hole of ["mainHole", "firstHole", "lastHole", "separation"]) {
    expect(image.occupancy[hole], `${hole} should remain transparent`).toBe(0);
  }
}

async function moveOnInk(page) {
  const image = await artwork(page);
  expect(image.inkPoint).not.toBeNull();
  await page.mouse.move(image.inkPoint.x, image.inkPoint.y, { steps: 8 });
  return image.inkPoint;
}

async function expectAccessibleLayout(page, image) {
  const viewport = page.viewportSize();
  expect(image.bounds.left).toBeGreaterThanOrEqual(0);
  expect(image.bounds.right).toBeLessThanOrEqual(viewport.width);
  expect(image.bounds.top).toBeGreaterThanOrEqual(0);
  expect(image.bounds.bottom).toBeLessThanOrEqual(viewport.height);
  expect(image.navigationOverlap, "navigation should not hide logo points").toBe(0);
  const nav = page.getByRole("navigation", { name: "Páginas del sitio" });
  await expect(nav.getByRole("link")).toHaveCount(5);
  for (const link of await nav.getByRole("link").all()) {
    const bounds = await link.boundingBox();
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
  }
  const textRegions = await page.locator(".atenea-wordmark, .atenea-back, .atenea-caption").evaluateAll((elements) => {
    const navBounds = document.querySelector('.page-nav').getBoundingClientRect();
    return elements.map((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const bounds = range.getBoundingClientRect();
      return { left: bounds.left, right: bounds.right, overlap: Math.min(bounds.right, navBounds.right) > Math.max(bounds.left, navBounds.left) && Math.min(bounds.bottom, navBounds.bottom) > Math.max(bounds.top, navBounds.top) };
    });
  });
  expect(textRegions.length).toBe(3);
  for (const text of textRegions) {
    expect(text.left).toBeGreaterThanOrEqual(0);
    expect(text.right).toBeLessThanOrEqual(viewport.width);
    expect(text.overlap, "navigation should not hide visible text").toBe(false);
  }
  const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe("ATENEA artwork", () => {
  test.use({ reducedMotion: "reduce" });

  test("the bare route loads green point artwork with the source proportions and three transparent A counters", async ({ page }) => {
    const externalRequests = [];
    page.on("request", (request) => {
      if (new URL(request.url()).origin !== "http://127.0.0.1:5173") externalRequests.push(request.url());
    });
    await page.addInitScript(() => {
      window.__ateneaDrawingProbe = { imageDraws: 0, points: 0 };
      const drawImage = CanvasRenderingContext2D.prototype.drawImage;
      const arc = CanvasRenderingContext2D.prototype.arc;
      CanvasRenderingContext2D.prototype.drawImage = function (...args) {
        if (this.canvas.id === "atenea-canvas") window.__ateneaDrawingProbe.imageDraws++;
        return Reflect.apply(drawImage, this, args);
      };
      CanvasRenderingContext2D.prototype.arc = function (...args) {
        if (this.canvas.id === "atenea-canvas") window.__ateneaDrawingProbe.points++;
        return Reflect.apply(arc, this, args);
      };
    });
    await openLogo(page, "/atenea");
    await expect(page).toHaveURL(/\/atenea\/$/);
    await expect(page).toHaveTitle(/ATENEA/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("ATENEA");
    await expect(page.locator(".atenea-wordmark")).toHaveText("ATENEA");
    await expect(page.locator(".atenea-wordmark")).toBeVisible();
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(4, 24, 39)");
    const state = await scene(page);
    expect(state.color).toBe("#00cc66");
    expect(state.count).toBeGreaterThan(2500);
    expect(state.shape).toBe("ATENEA");
    expect(state.sourceAspect).toBeGreaterThan(0.92);
    expect(state.sourceAspect).toBeLessThan(0.96);
    const image = await artwork(page);
    expectFaithfulArtwork(image, state);
    await expectAccessibleLayout(page, image);
    const drawing = await page.evaluate(() => window.__ateneaDrawingProbe);
    expect(drawing.imageDraws).toBe(0);
    expect(drawing.points).toBeGreaterThanOrEqual(state.count);
    expect(externalRequests).toEqual([]);
  });
});

test("the mouse changes the actual point image without breaking the logo and returns to its silhouette", async ({ page }) => {
  await openLogo(page);
  const initial = await scene(page);
  const before = await artwork(page);
  await moveOnInk(page);
  await expect.poll(async () => (await scene(page)).pointer.inside).toBe(true);
  await expect.poll(async () => (await scene(page)).maxDisplacement).toBeGreaterThan(0.3);
  await expect.poll(async () => Math.abs((await scene(page)).rotation.y)).toBeGreaterThan(0.001);
  const moved = await scene(page);
  const changed = await artwork(page);
  expect(moved.maxDisplacement).toBeLessThanOrEqual(6.1);
  expect(Math.abs(moved.rotation.x)).toBeLessThanOrEqual(0.017);
  expect(Math.abs(moved.rotation.y)).toBeLessThanOrEqual(0.019);
  expect(moved.count).toBe(initial.count);
  expect(changed.hash).not.toBe(before.hash);
  expect(changed.offGreen, JSON.stringify(changed.greenOutliers)).toBe(0);
  expect(changed.drawn).toBeGreaterThan(before.drawn * 0.8);
  expect(changed.bounds.left).toBeGreaterThanOrEqual(before.bounds.left - 9);
  expect(changed.bounds.right).toBeLessThanOrEqual(before.bounds.right + 9);
  await page.mouse.move(-10, -10);
  await expect.poll(async () => (await scene(page)).pointer.inside).toBe(false);
  await expect.poll(async () => (await scene(page)).maxDisplacement).toBeLessThan(0.3);
  await expect.poll(async () => Math.abs((await scene(page)).rotation.y)).toBeLessThan(0.0002);
  expectFaithfulArtwork(await artwork(page), await scene(page));
});

test("click, Enter, and Space create bounded waves and reset restores the green mark", async ({ page }) => {
  await openLogo(page);
  const initial = await scene(page);
  const original = await artwork(page);
  const point = await moveOnInk(page);
  await page.mouse.click(point.x, point.y);
  await expect.poll(async () => (await scene(page)).waves).toBeGreaterThan(0);
  await expect.poll(async () => (await scene(page)).maxDisplacement).toBeGreaterThan(0.5);
  expect((await scene(page)).maxDisplacement).toBeLessThanOrEqual(8.1);
  expect((await artwork(page)).hash).not.toBe(original.hash);
  await page.locator("#atenea-reset").click();
  let reset = await scene(page);
  expect(reset.waves).toBe(0);
  expect(reset.pointer.inside).toBe(false);
  expect(reset.count).toBe(initial.count);
  expect(reset.maxDisplacement).toBeLessThan(0.1);
  expectFaithfulArtwork(await artwork(page), reset);
  for (const key of ["Enter", "Space"]) {
    await page.locator("#atenea-canvas").focus();
    await expect(page.locator("#atenea-canvas")).toBeFocused();
    await page.keyboard.press(key);
    await expect.poll(async () => (await scene(page)).waves).toBeGreaterThan(0);
    await expect.poll(async () => (await scene(page)).frames).toBeGreaterThan(reset.frames + 15);
    expect((await scene(page)).maxDisplacement).toBeLessThanOrEqual(8.1);
    await page.locator("#atenea-reset").click();
    reset = await scene(page);
    expect(reset.waves).toBe(0);
    expect(reset.shape).toBe("ATENEA");
    expectFaithfulArtwork(await artwork(page), reset);
  }
});

test("the five page links navigate to each branch and keyboard navigation returns to ATENEA", async ({ page }) => {
  await openLogo(page);
  const paths = ["/", "/benve/", "/initiatives/education/", "/initiatives/presidential-challenge/", "/atenea/"];
  for (const path of paths) {
    const nav = page.getByRole("navigation", { name: "Páginas del sitio" });
    await expect(nav.getByRole("link")).toHaveCount(5);
    const target = nav.locator(`a[href="${path}"]`);
    if (path === "/atenea/") {
      await target.focus();
      await expect(target).toBeFocused();
      await page.keyboard.press("Enter");
    } else await target.click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(path);
    const active = page.getByRole("navigation", { name: "Páginas del sitio" }).locator('[aria-current="page"]');
    await expect(active).toHaveCount(1);
    await expect(active).toHaveAttribute("href", path);
  }
  await expect(page.locator("#atenea-canvas")).toHaveAttribute("data-particle-ready", "true");
  expect((await artwork(page)).drawn).toBeGreaterThan(1200);
  await page.getByRole("navigation", { name: "Páginas del sitio" }).locator('a[href="/"]').click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/");
  await expect(page.locator("#field")).toHaveAttribute("data-particle-ready", "true");
});

for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
  test.describe(`ATENEA mobile ${viewport.width}px`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });

    test("preserves every letter and hollow A, fits its navigation, and responds to touch", async ({ page }) => {
      await openLogo(page);
      const initial = await scene(page);
      const image = await artwork(page);
      expectFaithfulArtwork(image, initial);
      await expectAccessibleLayout(page, image);
      await page.touchscreen.tap(image.inkPoint.x, image.inkPoint.y);
      await expect.poll(async () => (await scene(page)).waves).toBeGreaterThan(0);
      await expect.poll(async () => (await scene(page)).pointer.inside).toBe(false);
      await page.locator("#atenea-reset").tap();
      expect((await scene(page)).waves).toBe(0);
      expect((await scene(page)).count).toBe(initial.count);
      expectFaithfulArtwork(await artwork(page), await scene(page));
      const benve = page.getByRole("navigation", { name: "Páginas del sitio" }).locator('a[href="/benve/"]');
      await benve.tap();
      await expect.poll(() => new URL(page.url()).pathname).toBe("/benve/");
      await expect(page.locator("#benve-canvas")).toHaveAttribute("data-particle-ready", "true");
      await page.getByRole("navigation", { name: "Páginas del sitio" }).locator('a[href="/atenea/"]').tap();
      await expect(page.locator("#atenea-canvas")).toHaveAttribute("data-particle-ready", "true");
      await expectAccessibleLayout(page, await artwork(page));
    });
  });
}

test.describe("ATENEA reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("stays still while pointer, reset, keyboard, and resize keep the actual artwork visible", async ({ page }) => {
    await openLogo(page);
    await page.waitForTimeout(100);
    const initial = await scene(page);
    const original = await artwork(page);
    expect(initial.reducedMotion).toBe(true);
    expect(initial.active).toBe(false);
    await page.waitForTimeout(350);
    expect((await scene(page)).frames).toBe(initial.frames);
    expect((await artwork(page)).hash).toBe(original.hash);
    await moveOnInk(page);
    expect((await scene(page)).maxDisplacement).toBeGreaterThan(0.1);
    expect((await artwork(page)).hash).not.toBe(original.hash);
    await page.locator("#atenea-reset").click();
    expect((await scene(page)).waves).toBe(0);
    expectFaithfulArtwork(await artwork(page), await scene(page));
    await page.locator("#atenea-canvas").focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    expect((await scene(page)).waves).toBe(0);
    const afterKeys = await scene(page);
    await page.waitForTimeout(250);
    expect((await scene(page)).frames).toBe(afterKeys.frames);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(async () => (await scene(page)).size.width).toBeLessThanOrEqual(390);
    await page.waitForTimeout(100);
    const resized = await scene(page);
    expect(resized.count).toBe(initial.count);
    const resizedImage = await artwork(page);
    expectFaithfulArtwork(resizedImage, resized);
    await expectAccessibleLayout(page, resizedImage);
    await page.waitForTimeout(250);
    expect((await scene(page)).frames).toBe(resized.frames);
  });
});

test("changing motion preference pauses frames and resumes responsive green points", async ({ page }) => {
  await openLogo(page);
  const running = await scene(page);
  await expect.poll(async () => (await scene(page)).frames).toBeGreaterThan(running.frames + 5);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(async () => (await scene(page)).reducedMotion).toBe(true);
  await expect.poll(async () => (await scene(page)).active).toBe(false);
  await page.waitForTimeout(100);
  const paused = await scene(page);
  const frozen = await artwork(page);
  await page.waitForTimeout(350);
  expect((await scene(page)).frames).toBe(paused.frames);
  expect((await artwork(page)).hash).toBe(frozen.hash);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(async () => (await scene(page)).reducedMotion).toBe(false);
  await expect.poll(async () => (await scene(page)).active).toBe(true);
  await expect.poll(async () => (await scene(page)).frames).toBeGreaterThan(paused.frames + 5);
  await moveOnInk(page);
  await expect.poll(async () => (await scene(page)).maxDisplacement).toBeGreaterThan(0.3);
  expect((await artwork(page)).hash).not.toBe(frozen.hash);
  expect((await artwork(page)).offGreen).toBe(0);
});
