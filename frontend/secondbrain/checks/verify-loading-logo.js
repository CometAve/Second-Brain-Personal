// Run against the Vite dev server using an existing Playwright CLI session:
// playwright-cli -s=sb-foundation run-code --filename=frontend/secondbrain/checks/verify-loading-logo.js
// This disposable same-origin page exercises the actual LoadingSpinner and renderer.
// App-route integration is checked separately in the task-owned browser session.
async function verifyLoadingLogo(page) {
  const checks = [];
  const assert = (condition, description) => {
    if (!condition) throw new Error(description);
    checks.push(description);
  };
  const fixture = await page.context().newPage();
  const artifacts = {
    video: '.playwright-cli/ui-refresh/loading-logo.webm',
    comparison: '.playwright-cli/ui-refresh/loading-logo-comparison.png',
    angles: [1, 2, 3].map((index) => `.playwright-cli/ui-refresh/loading-logo-angle-${index}.png`),
  };
  let recorded = false;
  let videoError = null;

  try {
    // Fetch a Vite module as the navigation target to establish the dev-server
    // origin without executing the authenticated app in this disposable page.
    await fixture.goto('http://localhost:5173/src/shared/components/loading-logo-renderer.ts');
    await fixture.setViewportSize({ width: 740, height: 380 });
    await fixture.setContent(`
      <html><head><link rel="stylesheet" href="/src/index.css"></head><body style="margin:0;background:#11101f;color:#eeeaf8;font:14px sans-serif">
        <main style="display:flex;align-items:center;justify-content:center;gap:38px;min-height:350px">
          <section style="text-align:center">
            <div style="position:relative;width:240px;height:240px">
              <img id="fallback" alt="" src="/src/shared/components/icon/Logo.svg"
                style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain">
              <canvas id="logo" width="240" height="240"
                style="position:absolute;inset:0;width:240px;height:240px"></canvas>
            </div>
            <span>3D 연결망 검수</span>
          </section>
          <canvas id="actual-size" width="128" height="128"
            style="width:128px;height:128px"></canvas>
          <section id="component" style="width:160px;text-align:center"></section>
        </main>
      </body></html>
    `);
    await fixture.evaluate(async () => {
      const refresh = await import('/@react-refresh');
      refresh.default.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => (type) => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      const { createElement } = (await import('/node_modules/.vite/deps/react.js')).default;
      const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
      const { LoadingSpinner } = await import('/src/shared/components/LoadingSpinner.tsx');
      const { startLogoAnimation, drawLogoFrame } =
        await import('/src/shared/components/loading-logo-renderer.ts');
      const nativeRequest = window.requestAnimationFrame.bind(window);
      const nativeCancel = window.cancelAnimationFrame.bind(window);
      const nativeMatchMedia = window.matchMedia.bind(window);
      const nativeAdd = document.addEventListener.bind(document);
      const nativeRemove = document.removeEventListener.bind(document);
      const scheduled = new Set();
      const listeners = { visibility: 0, motion: 0 };
      let painted = 0;

      window.requestAnimationFrame = (callback) => {
        const id = nativeRequest((time) => {
          scheduled.delete(id);
          callback(time);
        });
        scheduled.add(id);
        return id;
      };
      window.cancelAnimationFrame = (id) => {
        scheduled.delete(id);
        nativeCancel(id);
      };
      window.matchMedia = (query) => {
        const actual = nativeMatchMedia(query);
        return {
          get matches() {
            return actual.matches;
          },
          addEventListener(type, callback) {
            if (type === 'change') listeners.motion += 1;
            actual.addEventListener(type, callback);
          },
          removeEventListener(type, callback) {
            if (type === 'change') listeners.motion -= 1;
            actual.removeEventListener(type, callback);
          },
        };
      };
      document.addEventListener = (type, callback, options) => {
        if (type === 'visibilitychange') listeners.visibility += 1;
        nativeAdd(type, callback, options);
      };
      document.removeEventListener = (type, callback, options) => {
        if (type === 'visibilitychange') listeners.visibility -= 1;
        nativeRemove(type, callback, options);
      };

      const logo = document.querySelector('#logo');
      const actualSize = document.querySelector('#actual-size');
      const stops = [
        startLogoAnimation(logo, 240, () => {
          painted += 1;
        }),
        startLogoAnimation(actualSize, 128, () => {
          painted += 1;
        }),
      ];
      const root = createRoot(document.querySelector('#component'));
      root.render(
        createElement(LoadingSpinner, { size: 'lg', fullScreen: false, message: '불러오는 중' }),
      );
      window.__loadingLogoCheck = {
        root,
        createRoot,
        createElement,
        LoadingSpinner,
        logo,
        painted: () => painted,
        scheduled: () => scheduled.size,
        listeners,
        snapshot: () => logo.toDataURL(),
        stop() {
          root.unmount();
          for (const stop of stops) stop();
        },
        restore() {
          window.requestAnimationFrame = nativeRequest;
          window.cancelAnimationFrame = nativeCancel;
          window.matchMedia = nativeMatchMedia;
          document.addEventListener = nativeAdd;
          document.removeEventListener = nativeRemove;
        },
        renderer: startLogoAnimation,
        drawLogoFrame,
      };
    });

    await fixture.waitForFunction(
      () => document.querySelector('#component canvas')?.style.opacity === '1',
    );
    assert(
      (await fixture.locator('#component [role="status"]').getAttribute('aria-label')) ===
        '불러오는 중',
      'actual LoadingSpinner mounts with its accessible loading status',
    );

    const started = await fixture.evaluate(() => ({
      painted: window.__loadingLogoCheck.painted(),
      scheduled: window.__loadingLogoCheck.scheduled(),
      listeners: { ...window.__loadingLogoCheck.listeners },
      initial: window.__loadingLogoCheck.snapshot(),
    }));
    assert(started.painted === 2, 'renderer painted both canvases immediately');
    assert(
      started.scheduled > 0 && started.listeners.visibility === 3 && started.listeners.motion === 3,
      'renderer owns one clock and visibility/motion subscriptions per canvas',
    );

    const capture = await fixture.evaluate(() => {
      const canvas = document.querySelector('#component canvas');
      if (!canvas.captureStream || !window.MediaRecorder) return 'Canvas recording unavailable';
      const chunks = [];
      const stream = canvas.captureStream(60);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size) chunks.push(event.data);
      });
      window.__loadingLogoRecording = { recorder, stream, chunks };
      recorder.start();
      return null;
    });
    videoError = capture;
    recorded = !capture;

    const frames = [started.initial];
    for (let index = 0; index < artifacts.angles.length; index += 1) {
      await fixture.waitForTimeout(1850);
      await fixture.screenshot({ path: artifacts.angles[index] });
      frames.push(await fixture.evaluate(() => window.__loadingLogoCheck.snapshot()));
    }
    assert(
      new Set(frames).size >= 3,
      'actual projected frames differ at three sampled rotation angles',
    );

    if (recorded) {
      const downloadPromise = fixture.waitForEvent('download');
      await fixture.evaluate(async () => {
        const { recorder, stream, chunks } = window.__loadingLogoRecording;
        await new Promise((resolve) => {
          recorder.addEventListener('stop', resolve, { once: true });
          recorder.stop();
        });
        for (const track of stream.getTracks()) track.stop();
        const url = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'loading-logo.webm';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
      const download = await downloadPromise;
      await download.saveAs(artifacts.video);
      recorded = false;
    }

    // Synthetic document.hidden override exercises the visibility handler.
    const hiddenResult = await fixture.evaluate(async () => {
      const original = Object.getOwnPropertyDescriptor(document, 'hidden');
      try {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
        const first = window.__loadingLogoCheck.snapshot();
        await new Promise((resolve) => setTimeout(resolve, 350));
        return {
          stopped: window.__loadingLogoCheck.scheduled() === 0,
          staticFrame: first === window.__loadingLogoCheck.snapshot(),
        };
      } finally {
        if (original) Object.defineProperty(document, 'hidden', original);
        else delete document.hidden;
        document.dispatchEvent(new Event('visibilitychange'));
      }
    });
    assert(
      hiddenResult.stopped && hiddenResult.staticFrame,
      'synthetic hidden tab stops its animation frame and holds the image',
    );

    await fixture.emulateMedia({ reducedMotion: 'reduce' });
    await fixture.waitForTimeout(100);
    const reducedStart = await fixture.evaluate(() => ({
      image: window.__loadingLogoCheck.snapshot(),
      scheduled: window.__loadingLogoCheck.scheduled(),
    }));
    await fixture.waitForTimeout(350);
    const reducedEnd = await fixture.evaluate(() => ({
      image: window.__loadingLogoCheck.snapshot(),
      scheduled: window.__loadingLogoCheck.scheduled(),
    }));
    assert(
      reducedStart.image === reducedEnd.image &&
        reducedStart.scheduled === 0 &&
        reducedEnd.scheduled === 0,
      'reduced motion displays a static traced 3D graph without queued frames',
    );

    const cleanup = await fixture.evaluate(async () => {
      const check = window.__loadingLogoCheck;
      check.stop();
      const afterStop = {
        scheduled: check.scheduled(),
        listeners: { ...check.listeners },
      };
      const componentHost = document.querySelector('#component');
      const fallbackRoot = check.createRoot(componentHost);
      const oldGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = () => null;
      let firstFrame = false;
      const release = check.renderer(document.createElement('canvas'), 96, () => {
        firstFrame = true;
      });
      release();
      fallbackRoot.render(
        check.createElement(check.LoadingSpinner, { size: 'md', fullScreen: false }),
      );
      // React must commit and the 120ms visual-delay timer must run before
      // checking the fallback; neither is guaranteed by a single 120ms sleep.
      const deadline = performance.now() + 1500;
      while (performance.now() < deadline) {
        const image = componentHost.querySelector('img');
        if (image && getComputedStyle(image).visibility !== 'hidden') break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      const fallback = componentHost.querySelector('img');
      const fallbackCanvas = componentHost.querySelector('canvas');
      HTMLCanvasElement.prototype.getContext = oldGetContext;
      const result = {
        ...afterStop,
        firstFrame,
        fallbackVisible: getComputedStyle(fallback).visibility !== 'hidden',
        fallbackLoaded: fallback.complete && fallback.naturalWidth > 0,
        fallbackCanvasHidden: fallbackCanvas.style.opacity === '0',
      };
      fallbackRoot.unmount();
      // A response that completes before the visual delay must cancel the
      // delayed clock, rather than briefly flash or start it after unmount.
      const fastRoot = check.createRoot(componentHost);
      fastRoot.render(check.createElement(check.LoadingSpinner, { fullScreen: false }));
      const fastDeadline = performance.now() + 1500;
      while (!componentHost.querySelector('img') && performance.now() < fastDeadline) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      result.fastHidden =
        getComputedStyle(componentHost.querySelector('img')).visibility === 'hidden';
      fastRoot.unmount();
      await new Promise((resolve) => setTimeout(resolve, 180));
      result.fastReleased =
        check.scheduled() === 0 && check.listeners.visibility === 0 && check.listeners.motion === 0;
      check.restore();
      return result;
    });
    assert(
      cleanup.scheduled === 0 &&
        cleanup.listeners.visibility === 0 &&
        cleanup.listeners.motion === 0,
      'renderer cleanup cancels frames and removes both listeners',
    );
    assert(
      !cleanup.firstFrame &&
        cleanup.fallbackVisible &&
        cleanup.fallbackLoaded &&
        cleanup.fallbackCanvasHidden,
      'unavailable Canvas 2D leaves the static original logo available',
    );
    assert(
      cleanup.fastHidden && cleanup.fastReleased,
      'fast unmount before the visual delay leaves no flash or delayed animation',
    );

    await fixture.setViewportSize({ width: 1100, height: 300 });
    await fixture.evaluate(() => {
      document.body.innerHTML = `<main style="display:flex;gap:10px;padding:10px;text-align:center">
        <section style="width:200px"><div style="height:200px;display:flex;align-items:center;justify-content:center"><img src="/Logo_upscale.png" width="171" height="171"></div><p>원본 이미지</p></section>
        ${[0, 60, 120, 180].map((angle) => `<section><canvas data-angle="${angle}" width="400" height="400" style="width:200px;height:200px"></canvas><p>Y축 회전 ${angle}°</p></section>`).join('')}
      </main>`;
      for (const canvas of document.querySelectorAll('canvas[data-angle]')) {
        const context = canvas.getContext('2d');
        context.setTransform(2, 0, 0, 2, 0, 0);
        window.__loadingLogoCheck.drawLogoFrame(
          context,
          200,
          (Number(canvas.dataset.angle) / 180) * Math.PI,
        );
      }
    });
    await fixture.waitForFunction(() => document.querySelector('img')?.complete);
    await fixture.screenshot({ path: artifacts.comparison });

    return {
      passed: true,
      scope:
        'actual LoadingSpinner plus real renderer in a disposable page; app-route integration checked separately',
      checks,
      artifacts: { ...artifacts, video: videoError ? null : artifacts.video },
      videoError,
    };
  } finally {
    if (recorded)
      await fixture.evaluate(() => {
        const { recorder, stream } = window.__loadingLogoRecording;
        if (recorder.state !== 'inactive') recorder.stop();
        for (const track of stream.getTracks()) track.stop();
      });
    await fixture.close();
  }
}
