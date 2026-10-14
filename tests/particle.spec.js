import { test, expect } from "@playwright/test";

const errorsByPage = new WeakMap();

test.beforeEach(async ({ page }) => {
  const errors = [];
  errorsByPage.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
});

test.afterEach(async ({ page }) => {
  expect(
    errorsByPage.get(page),
    "The page should not produce uncaught JavaScript errors",
  ).toEqual([]);
});

const state = (page) => page.evaluate(() => window.__particleScene.getState());

async function openScene(page, path = "/") {
  await page.goto(path);
  await expect(page.locator("#field")).toHaveAttribute("data-particle-ready", "true");
  await expect(page.locator("#field")).toBeVisible();
}

async function pixels(page) {
  return page.locator("#field").evaluate((canvas) => {
    const { width, height } = canvas;
    const data = canvas.getContext("2d").getImageData(0, 0, width, height).data;
    let drawn = 0;
    let red = 0;
    let hash = 2166136261;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let offset = 0; offset < data.length; offset += 4) {
      hash = Math.imul(hash ^ data[offset + 3], 16777619) >>> 0;
      if (data[offset + 3] > 10) {
        drawn += 1;
        if (data[offset] > data[offset + 1] * 1.5) red += 1;
        const point = offset / 4;
        const x = point % width;
        const y = Math.floor(point / width);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    return {
      drawn,
      red,
      hash,
      width,
      height,
      figureWidth: maxX - minX + 1,
      figureHeight: maxY - minY + 1,
    };
  });
}

async function showSection(page, locator, expectedForm) {
  await locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    window.scrollTo({
      top:
        window.scrollY +
        bounds.top +
        bounds.height / 2 -
        window.innerHeight / 2,
      behavior: "instant",
    });
  });
  await expect.poll(async () => (await state(page)).form).toBe(expectedForm);
}

test("loads an animated particle canvas with real visible points and no JavaScript errors", async ({
  page,
}) => {
  await openScene(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Super Intelligence",
  );
  const initial = await state(page);
  expect(initial.count).toBeGreaterThanOrEqual(1000);
  expect(initial.form).toBe("text:SI;hero");
  expect(initial.active).toBe(true);
  const image = await pixels(page);
  expect(image.drawn).toBeGreaterThan(2000);
  expect(image.drawn).toBeLessThan(image.width * image.height * 0.25);
  expect(image.figureWidth).toBeGreaterThan(200);
  expect(image.figureHeight).toBeGreaterThan(100);
  await expect
    .poll(async () => (await state(page)).frames)
    .toBeGreaterThan(initial.frames + 3);
});

test("hovering SI morphs its points into Super Intelligence and leaving restores SI", async ({
  page,
}) => {
  await openScene(page);
  await expect
    .poll(async () => (await state(page)).maxDisplacement)
    .toBeLessThan(3);
  const original = await pixels(page);
  await page.mouse.move(720, 350, { steps: 10 });
  await expect
    .poll(async () => (await state(page)).form)
    .toBe("snake:Super|Intelligence;hero2");
  await expect
    .poll(async () => (await pixels(page)).hash)
    .not.toBe(original.hash);
  await page.mouse.move(20, 900, { steps: 5 });
  await expect.poll(async () => (await state(page)).form).toBe("text:SI;hero");
  await expect
    .poll(async () => (await state(page)).maxDisplacement)
    .toBeLessThan(3);
});

test("mouse movement deforms the 3D sphere and a click sends a visible wave through it", async ({
  page,
}) => {
  await openScene(page);
  await showSection(
    page,
    page.locator('[data-form="sphere:ring"]').first(),
    "sphere:ring;right",
  );
  await page.waitForTimeout(1800);
  const initial = await state(page);
  const image = await pixels(page);
  await page.mouse.move(1050, 450, { steps: 8 });
  await expect
    .poll(async () => (await state(page)).maxDisplacement)
    .toBeGreaterThan(initial.maxDisplacement + 5);
  const moved = await state(page);
  expect(moved.mouse.x).toBe(1050);
  expect(moved.mouse.y).toBe(450);
  expect((await pixels(page)).hash).not.toBe(image.hash);
  await page.mouse.click(1050, 450);
  await expect.poll(async () => (await state(page)).waves).toBeGreaterThan(0);
  await page.mouse.move(5, 5);
  await expect.poll(async () => (await state(page)).waves).toBe(0);
  await expect
    .poll(async () => (await state(page)).maxDisplacement)
    .toBeLessThan(moved.maxDisplacement);
});

test("scrolling changes the point cloud through the six documented forms", async ({
  page,
}) => {
  await openScene(page);
  const forms = [
    ["sphere:ring", "sphere:ring;right"],
    ["text:13", "text:13;right"],
    ["helix", "helix;right"],
    ["towers", "towers;right"],
    ["scatter", "scatter;right"],
    ["flag;right", "flag;right"],
  ];
  const fingerprints = new Set();
  for (const [selector, form] of forms) {
    await showSection(
      page,
      page.locator(`[data-form="${selector}"]`).first(),
      form,
    );
    await page.waitForTimeout(500);
    const image = await pixels(page);
    expect(image.drawn).toBeGreaterThan(1000);
    fingerprints.add(image.hash);
  }
  expect(fingerprints.size).toBe(forms.length);
  await expect(page.locator("#ninety")).toHaveText("13");
});

test("the explore button, section dots, and menu provide working navigation", async ({
  page,
}) => {
  await openScene(page);
  await page
    .getByRole("link", { name: "Explore Initiatives", exact: true })
    .click();
  await expect(page.locator("#initiatives")).toBeInViewport();
  await expect.poll(async () => (await state(page)).form).toBe("scatter;right");
  await page.locator("#dots a").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
  await expect.poll(async () => (await state(page)).form).toBe("text:SI;hero");
  const orb = page.locator("#orb");
  await orb.click();
  await expect(orb).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(orb).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#menu")).toBeHidden();
  await orb.click();
  await page
    .locator("#menuList")
    .getByRole("link", { name: /Education/ })
    .click();
  await expect(page).toHaveURL(/\/initiatives\/education\/?$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Education",
  );
  await expect.poll(async () => (await state(page)).ready).toBe(true);
  await page.locator("#orb").click();
  await page.locator("#menuList").getByRole("link", { name: /Home/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Super Intelligence",
  );
});

test("keyboard users can create a particle wave without a pointer", async ({
  page,
}) => {
  await openScene(page);
  await page.locator("#field").focus();
  await expect(page.locator("#field")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await state(page)).waves).toBeGreaterThan(0);
  await expect.poll(async () => (await state(page)).waves).toBe(0);
  await page.keyboard.press("Space");
  await expect.poll(async () => (await state(page)).waves).toBeGreaterThan(0);
});

test("changing the motion preference pauses and then resumes the live canvas", async ({
  page,
}) => {
  await openScene(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(async () => (await state(page)).reducedMotion).toBe(true);
  await expect.poll(async () => (await state(page)).active).toBe(false);
  await expect(page.locator("#cursor")).toBeHidden();
  await page.waitForTimeout(100);
  const paused = await state(page);
  await page.waitForTimeout(400);
  expect((await state(page)).frames).toBe(paused.frames);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(async () => (await state(page)).active).toBe(true);
  await expect
    .poll(async () => (await state(page)).frames)
    .toBeGreaterThan(paused.frames + 3);
  await expect(page.locator("#cursor")).toBeVisible();
  const cursorTransform = await page.locator("#cursor").evaluate((element) => element.style.transform);
  await page.mouse.move(120, 120, { steps: 3 });
  await expect.poll(async () => page.locator("#cursor").evaluate((element) => element.style.transform)).not.toBe(cursorTransform);
});

test("the presidential challenge loads locally and its menu renders the original seal particles", async ({
  page,
}) => {
  const sealResponse = page.waitForResponse((response) =>
    response.url().endsWith("/images/seal.png"),
  );
  await openScene(page, "/initiatives/presidential-challenge/");
  expect((await sealResponse).ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Presidential SI Challenge",
  );
  await expect(page.locator("#video .vfall")).toHaveAttribute(
    "href",
    "https://youtu.be/FozZvEv8U9w",
  );
  await expect(page.locator("#video iframe")).toHaveCount(0);
  await page.locator("#orb").click();
  await expect
    .poll(async () => (await state(page)).form)
    .toBe("image:seal;right");
  await page.mouse.move(-10, -10);
  await expect
    .poll(async () => (await state(page)).maxDisplacement)
    .toBeLessThan(3);
  const image = await pixels(page);
  expect(image.drawn).toBeGreaterThan(1000);
  expect(image.figureHeight).toBeGreaterThan(150);
  expect(image.figureWidth).toBeGreaterThan(150);
});

test("newsletter validates addresses and explains the subscription destination without sending data", async ({
  page,
}) => {
  await openScene(page);
  const unexpectedRequests = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.origin !== "http://127.0.0.1:5173" ||
      request.method() !== "GET" ||
      request.url().includes("test-reader") ||
      request.postData()?.includes("test-reader")
    ) {
      unexpectedRequests.push({ url: request.url(), method: request.method() });
    }
  });
  const email = page.getByRole("textbox", { name: "Email address" });
  await email.fill("invalid-address");
  await page.locator("#mc").getByRole("button", { name: "Sign up" }).click();
  await expect(page.locator("#mcMsg")).toHaveText(
    "Enter a valid email address.",
  );
  await email.fill("test-reader@example.com");
  await expect(page.locator("#mcMsg")).toBeEmpty();
  await page.locator("#mc").getByRole("button", { name: "Sign up" }).click();
  await expect(page.locator("#mcMsg")).toHaveText("Visit SI.gov to subscribe.");
  await page.waitForTimeout(200);
  expect(unexpectedRequests).toEqual([]);
});

for (const width of [390, 320]) {
  test(`mobile ${width}px renders particles, stays in the viewport, and opens its menu`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await openScene(page);
    const dimensions = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      text: [...document.querySelectorAll(".hero .col, .init")].map(
        (element) => {
          const bounds = element.getBoundingClientRect();
          return { left: bounds.left, right: bounds.right };
        },
      ),
    }));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
    for (const bounds of dimensions.text) {
      expect(bounds.left).toBeGreaterThanOrEqual(0);
      expect(bounds.right).toBeLessThanOrEqual(width);
    }
    expect((await pixels(page)).drawn).toBeGreaterThan(1000);
    await page
      .getByRole("link", { name: "Explore Initiatives", exact: true })
      .click();
    await expect(page.locator("#initiatives")).toBeInViewport();
    await expect
      .poll(async () => (await state(page)).form)
      .toBe("scatter;right");
    await page.locator("#orb").click();
    await expect(page.locator("#orb")).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.locator("#menuList").getByRole("link", { name: /Home/ }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
  });
}

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("stops continuous animation while hover and scroll still visibly change the sculpture", async ({
    page,
  }) => {
    await openScene(page);
    await page.waitForTimeout(100);
    const initial = await state(page);
    expect(initial.reducedMotion).toBe(true);
    expect(initial.active).toBe(false);
    const original = await pixels(page);
    await page.waitForTimeout(400);
    expect((await state(page)).frames).toBe(initial.frames);
    expect((await pixels(page)).hash).toBe(original.hash);

    await page.mouse.move(720, 350);
    await expect
      .poll(async () => (await state(page)).form)
      .toBe("snake:Super|Intelligence;hero2");
    expect((await pixels(page)).hash).not.toBe(original.hash);
    await page.mouse.move(5, 5);

    const fingerprints = new Set();
    for (const selector of ["sphere:ring", "helix", "towers", "flag;right"]) {
      const form = selector.includes(";") ? selector : `${selector};right`;
      await showSection(
        page,
        page.locator(`[data-form="${selector}"]`).first(),
        form,
      );
      const image = await pixels(page);
      expect(image.drawn).toBeGreaterThan(1000);
      fingerprints.add(image.hash);
    }
    expect(fingerprints.size).toBe(4);
    const final = await state(page);
    await page.waitForTimeout(400);
    expect((await state(page)).frames).toBe(final.frames);
    expect(final.active).toBe(false);
  });
});
