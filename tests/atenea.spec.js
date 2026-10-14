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
  await waitForLogo(page);
}

async function waitForLogo(page) {
  const canvas = page.locator("#atenea-canvas");
  await expect(canvas).toHaveAttribute("data-particle-ready", "true");
  await expect(canvas).toHaveAttribute("data-particle-frames", /^[1-9]\d*$/);
  await expect(canvas).toBeVisible();
  await expect.poll(async () => (await scene(page)).entry.complete).toBe(true);
  await expect.poll(async () => (await scene(page)).maxDisplacement).toBeLessThan(0.3);
}

async function artwork(page) {
  return page.locator("#atenea-canvas").evaluate((canvas) => {
    const state = window.__ateneaScene.getState();
    const rect = canvas.getBoundingClientRect();
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    const regions = {
      tip: [411, 181, 429, 209],
      leftSide: [295, 409, 309, 446],
      rightSide: [533, 409, 547, 446],
      curvedBase: [403, 446, 433, 460],
      mainHole: [402, 345, 437, 384],
      belowCurvedBase: [407, 489, 428, 502],
      oldLetters: [166, 578, 668, 684],
    };
    const occupancy = Object.fromEntries(Object.keys(regions).map((name) => [name, 0]));
    const navRects = [...document.querySelectorAll('.page-nav a')].map((link) => {
      const bounds = link.getBoundingClientRect();
      return { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom };
    });
    let drawn = 0, offGreen = 0, navigationOverlap = 0, hash = 2166136261;
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    let sumX = 0, sumY = 0;
    let nearestDistance = Infinity, inkPoint = null;
    const greenOutliers = [];
    for (let offset = 0; offset < data.length; offset += 4) {
      hash = Math.imul(hash ^ data[offset + 3], 16777619) >>> 0;
      if (data[offset + 3] < 100) continue;
      drawn++;
      const [red, green, blue] = [data[offset], data[offset + 1], data[offset + 2]];
      // Unpremultiplication can move antialiased boundary channels by a few units.
      if (Math.abs(red - 57) > 8 || Math.abs(green - 255) > 8 || Math.abs(blue - 20) > 8) {
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
      sumX += x; sumY += y;
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
      centroid: { x: rect.left + sumX / drawn, y: rect.top + sumY / drawn },
      width: right - left, height: bottom - top,
      bounds: { left: rect.left + left, right: rect.left + right, top: rect.top + top, bottom: rect.top + bottom },
    };
  });
}

function expectFaithfulArtwork(image, state) {
  expect(image.drawn).toBeGreaterThan(1200);
  expect(image.offGreen, JSON.stringify(image.greenOutliers)).toBe(0);
  expect(image.width / image.height).toBeGreaterThan(0.81);
  expect(image.width / image.height).toBeLessThan(0.91);
  expect(image.width / image.height).toBeCloseTo(state.sourceAspect, 1);
  expect(state.size.logoWidth / state.size.logoHeight).toBeCloseTo(state.sourceAspect, 5);
  for (const region of ["tip", "leftSide", "rightSide", "curvedBase"]) {
    expect(image.occupancy[region], `${region} should contain real green points`).toBeGreaterThan(15);
  }
  for (const hole of ["mainHole", "belowCurvedBase", "oldLetters"]) {
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
  const textRegions = await page.locator(".atenea-wordmark, .atenea-back").evaluateAll((elements) => {
    const navBounds = document.querySelector('.page-nav').getBoundingClientRect();
    return elements.map((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const bounds = range.getBoundingClientRect();
      return { left: bounds.left, right: bounds.right, overlap: Math.min(bounds.right, navBounds.right) > Math.max(bounds.left, navBounds.left) && Math.min(bounds.bottom, navBounds.bottom) > Math.max(bounds.top, navBounds.top) };
    });
  });
  expect(textRegions.length).toBe(2);
  for (const text of textRegions) {
    expect(text.left).toBeGreaterThanOrEqual(0);
    expect(text.right).toBeLessThanOrEqual(viewport.width);
    expect(text.overlap, "navigation should not hide visible text").toBe(false);
  }
  const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const verticalOverflow = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - innerHeight);
  expect(verticalOverflow, "the single triangle should fit one viewport without a second scene").toBeLessThanOrEqual(1);
}

test.describe("ATENEA artwork", () => {
  test.use({ reducedMotion: "reduce" });

  test("the bare route shows only the neon triangle with its source proportions and transparent center", async ({ page }) => {
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
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(8, 35, 57)");
    const state = await scene(page);
    expect(state.color).toBe("#39ff14");
    expect(state.count).toBeGreaterThan(2000);
    expect(state.shape).toBe("triangle");
    expect(state.entry).toEqual({ progress: 1, complete: true });
    expect(state.sourceAspect).toBeGreaterThan(0.84);
    expect(state.sourceAspect).toBeLessThan(0.88);
    await expect(page.locator(".atenea-stage")).toHaveCSS("position", "fixed");
    expect(await page.locator("#atenea-canvas").boundingBox()).toEqual({ x: 0, y: 0, width: 1440, height: 1000 });
    const image = await artwork(page);
    expectFaithfulArtwork(image, state);
    await expectAccessibleLayout(page, image);
    const drawing = await page.evaluate(() => window.__ateneaDrawingProbe);
    expect(drawing.imageDraws).toBe(0);
    expect(drawing.points).toBeGreaterThanOrEqual(state.count);
    await page.mouse.wheel(0, 1000);
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    expect((await artwork(page)).hash).toBe(image.hash);
    expect(externalRequests).toEqual([]);
  });
});

test("the neon point cloud enters from the right before assembling the original triangle", async ({ page }) => {
  await page.goto("/atenea/");
  await expect(page.locator("#atenea-canvas")).toHaveAttribute("data-particle-ready", "true");
  const starting = await scene(page);
  expect(starting.entry.complete).toBe(false);
  expect(starting.entry.progress).toBeLessThan(0.8);
  await expect.poll(async () => (await artwork(page)).drawn).toBeGreaterThan(300);
  const arriving = await artwork(page);
  const progress = await scene(page);
  expect(progress.entry.complete).toBe(false);
  expect(arriving.centroid.x).toBeGreaterThan(progress.center.x + progress.bounds.width * 0.2);
  expect(arriving.offGreen).toBe(0);
  await waitForLogo(page);
  const assembled = await artwork(page);
  const final = await scene(page);
  expect(final.count).toBe(starting.count);
  expect(assembled.hash).not.toBe(arriving.hash);
  expect(assembled.centroid.x).toBeLessThan(arriving.centroid.x - 100);
  expectFaithfulArtwork(assembled, final);
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

test("click, Enter, and Space create bounded waves while reset restores the triangle", async ({ page }) => {
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
  expect(reset.shape).toBe("triangle");
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
    expect(reset.shape).toBe("triangle");
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
  await waitForLogo(page);
  expect((await artwork(page)).drawn).toBeGreaterThan(1200);
  await page.getByRole("navigation", { name: "Páginas del sitio" }).locator('a[href="/"]').click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/");
  await expect(page.locator("#field")).toHaveAttribute("data-particle-ready", "true");
});

for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
  test.describe(`ATENEA mobile ${viewport.width}px`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });

    test("preserves the hollow triangle, fits one viewport and its navigation, and responds to touch", async ({ page }) => {
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
      expect((await scene(page)).shape).toBe("triangle");
      await page.mouse.wheel(0, 800);
      await page.waitForTimeout(100);
      expect(await page.evaluate(() => scrollY)).toBe(0);
      const benve = page.getByRole("navigation", { name: "Páginas del sitio" }).locator('a[href="/benve/"]');
      await benve.tap();
      await expect.poll(() => new URL(page.url()).pathname).toBe("/benve/");
      await expect(page.locator("#benve-canvas")).toHaveAttribute("data-particle-ready", "true");
      await page.getByRole("navigation", { name: "Páginas del sitio" }).locator('a[href="/atenea/"]').tap();
      await waitForLogo(page);
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
    expect(initial.entry).toEqual({ progress: 1, complete: true });
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
    expect((await scene(page)).shape).toBe("triangle");
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
