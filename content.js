// Content script for PDF Dark Mode
// Prevent duplicate initialization
if (!window.pdfDarkModeInitialized) {
  window.pdfDarkModeInitialized = true;

  (function () {
    // Settings and state
    window.settings = window.settings || {
      darkMode: false,
      inversionStrength: 95,
      contrastLevel: 100,
    };

    const originalCanvasData = new WeakMap();
    const originalImageStyles = new WeakMap();

    // Load ColorUtils when needed
    function loadColorUtils() {
      return new Promise((resolve, reject) => {
        if (window.ColorUtils) return resolve(window.ColorUtils);
        const s = document.createElement('script');
        s.src = chrome.runtime.getURL('colorUtils.js');
        s.onload = () => {
          if (window.ColorUtils) resolve(window.ColorUtils);
          else reject(new Error('ColorUtils not available'));
        };
        s.onerror = (e) => reject(e || new Error('Failed to load colorUtils'));
        (document.head || document.documentElement).appendChild(s);
      });
    }

    // Utility: generate CSS based on settings
    function generateDarkModeCSS() {
      const inv = window.settings.inversionStrength || 95;
      const con = window.settings.contrastLevel || 100;

      // Apply a top-level filter as a strong fallback. It may invert UI chrome in some viewers,
      // but ensures visible change when pixel-level manipulation is impossible.
      return `
html.pdf-dark-mode-active {
  background-color: #292929 !important;
  filter: invert(${inv}%) hue-rotate(180deg) contrast(${con}%) !important;
  transition: filter 0.35s ease, background-color 0.35s ease;
}
html.pdf-dark-mode-active embed[type="application/pdf"],
html.pdf-dark-mode-active object[type="application/pdf"],
html.pdf-dark-mode-active .pdfViewer,
html.pdf-dark-mode-active #viewer,
html.pdf-dark-mode-active #viewerContainer,
html.pdf-dark-mode-active .textLayer,
html.pdf-dark-mode-active .canvasWrapper,
html.pdf-dark-mode-active [data-pdf-dark-mode] {
  transition: filter 0.2s ease-in-out;
}
html.pdf-dark-mode-active .pdfViewer img,
html.pdf-dark-mode-active #viewer img { filter: invert(100%) hue-rotate(180deg) !important; }
`;
    }

    // Inject style element
    function injectDarkModeStyle() {
      if (document.getElementById('pdf-dark-mode-style')) return;
      const style = document.createElement('style');
      style.id = 'pdf-dark-mode-style';
      style.textContent = generateDarkModeCSS();
      (document.head || document.documentElement).appendChild(style);
    }

    // Remove style element
    function removeDarkModeStyle() {
      const el = document.getElementById('pdf-dark-mode-style');
      if (el) el.remove();
    }

    // Canvas handling
    function processPdfCanvases() {
      if (!window.settings.darkMode) return; // don't apply when dark mode is off
      const canvases = Array.from(document.querySelectorAll('canvas'));
      canvases.forEach((c) => applyCanvasFilter(c));
    }

    // When dark mode is activated, some canvases may be created/painted shortly after.
    // Poll for canvases for a short time to catch late-rendered canvases.
    let _canvasPollTimer = null;
    function startCanvasPolling(timeoutMs = 3000, intervalMs = 300) {
      if (_canvasPollTimer) return;
      const start = Date.now();
      _canvasPollTimer = setInterval(() => {
        if (window.settings.darkMode) processPdfCanvases();
        if (Date.now() - start > timeoutMs) {
          clearInterval(_canvasPollTimer);
          _canvasPollTimer = null;
        }
      }, intervalMs);
    }

    function applyCanvasFilter(canvas) {
      if (!canvas || canvas.hasAttribute('data-pdf-dark-mode')) return;
      console.debug('applyCanvasFilter for canvas', canvas);

      const maxPixelsForRecolor = 2_000_000;
      const pixels = canvas.width * canvas.height;

      // Try pixel recolor when small enough and ColorUtils available
      if (pixels > 0 && pixels <= maxPixelsForRecolor) {
        const tryRecolor = () =>
          loadColorUtils()
            .then(() => recolorCanvas(canvas))
            .catch(() => applyCssToElement(canvas));
        // If ColorUtils already present, recolor immediately
        if (window.ColorUtils) recolorCanvas(canvas).catch((err) => { console.warn('recolorCanvas failed, fallback to css', err); applyCssToElement(canvas); });
        else tryRecolor();
      } else {
        applyCssToElement(canvas);
      }
    }

    function applyCssToElement(el) {
      console.debug('Applying CSS filter to element', el);
      el.setAttribute('data-pdf-dark-mode', 'true');
      el.setAttribute('data-pdf-dark-mode-method', 'css');
      // ensure a smooth transition when filter changes
      try {
        el.style.transition = el.style.transition || 'filter 0.35s ease, opacity 0.35s ease';
        el.style.opacity = el.style.opacity || '1';
      } catch (e) {}
      el.style.filter = `invert(${window.settings.inversionStrength}%) hue-rotate(180deg) contrast(${window.settings.contrastLevel}%)`;
    }

    async function recolorCanvas(canvas) {
      console.debug('Attempting pixel recolor for canvas', canvas);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return applyCssToElement(canvas);

      try {
        const w = canvas.width;
        const h = canvas.height;
        // If we have saved original pixels, use them as the source for recolor so updates don't compound.
        let baseImage = originalCanvasData.get(canvas);
        if (!baseImage) {
          const current = ctx.getImageData(0, 0, w, h);
          // save original copy
          originalCanvasData.set(canvas, new ImageData(new Uint8ClampedArray(current.data), w, h));
          baseImage = originalCanvasData.get(canvas);
        }

        // Work on a copy of the base pixels so we don't mutate the saved original
        const img = new ImageData(new Uint8ClampedArray(baseImage.data), w, h);
        const data = img.data;
        const inv = Number(window.settings.inversionStrength) || 95;
        const con = Number(window.settings.contrastLevel) || 100;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const out = ColorUtils.invertColor(r, g, b, inv, con);
          data[i] = out.r;
          data[i + 1] = out.g;
          data[i + 2] = out.b;
        }

        // Fade in the recolored canvas for a smooth transition
        try {
          canvas.style.transition = canvas.style.transition || 'opacity 0.35s ease, filter 0.35s ease';
          canvas.style.opacity = '0';
        } catch (e) {}

        ctx.putImageData(img, 0, 0);

        // ensure the browser paints the updated pixels then fade in
        requestAnimationFrame(() => {
          setTimeout(() => {
            try { canvas.style.opacity = '1'; } catch (e) {}
          }, 20);
        });

        canvas.setAttribute('data-pdf-dark-mode', 'true');
        canvas.setAttribute('data-pdf-dark-mode-method', 'colorutils');
        console.debug('Recolor successful for canvas', canvas);
      } catch (e) {
        console.warn('Recolor threw, falling back to CSS', e);
        applyCssToElement(canvas);
      }
    }

    function restoreCanvasOriginal(canvas) {
      try {
        const ctx = canvas.getContext('2d');
        const orig = originalCanvasData.get(canvas);
        // Fade out current recolored canvas, then restore original pixels and fade in
        try { canvas.style.transition = canvas.style.transition || 'opacity 0.28s ease, filter 0.28s ease'; canvas.style.opacity = '0'; } catch (e) {}
        setTimeout(() => {
          try {
            if (ctx && orig) ctx.putImageData(orig, 0, 0);
          } catch (err) {}
          try { canvas.style.opacity = '1'; } catch (e) {}
          // cleanup
          canvas.style.filter = '';
          canvas.removeAttribute('data-pdf-dark-mode');
          canvas.removeAttribute('data-pdf-dark-mode-method');
          originalCanvasData.delete(canvas);
        }, 300);
      } catch (e) {
        // ignore
        try { canvas.style.filter = ''; canvas.removeAttribute('data-pdf-dark-mode'); canvas.removeAttribute('data-pdf-dark-mode-method'); originalCanvasData.delete(canvas); } catch (er) {}
      }
    }

    function updateCanvasFilters() {
      document.querySelectorAll('[data-pdf-dark-mode="true"]').forEach((el) => {
        const method = el.getAttribute('data-pdf-dark-mode-method') || 'css';
        if (method === 'colorutils') {
          // recolor (best-effort)
          recolorCanvas(el).catch(() => {});
        } else {
          el.style.filter = `invert(${window.settings.inversionStrength}%) hue-rotate(180deg) contrast(${window.settings.contrastLevel}%)`;
        }
      });
    }

    function resetCanvasElements() {
      document.querySelectorAll('[data-pdf-dark-mode="true"]').forEach((el) => {
        const method = el.getAttribute('data-pdf-dark-mode-method') || 'css';
        if (method === 'colorutils') restoreCanvasOriginal(el);
        else {
          // Smoothly transition filter removal
          try { el.style.transition = el.style.transition || 'filter 0.35s ease, opacity 0.35s ease'; } catch (e) {}
          el.style.filter = '';
          // remove attributes after transition
          setTimeout(() => {
            try { el.removeAttribute('data-pdf-dark-mode'); el.removeAttribute('data-pdf-dark-mode-method'); } catch (e) {}
          }, 360);
        }
      });
    }

    // Image handling (CSS-based to avoid CORS issues)
    function processPdfImages() {
      const imgs = Array.from(document.querySelectorAll('img'));
      imgs.forEach((img) => {
        // Heuristic: images that are likely part of viewer
        if (img.closest('.pdfViewer') || img.closest('#viewer') || img.closest('.page') || img.src?.startsWith('data:')) {
          applyImageFilter(img);
        }
      });
    }

    function applyImageFilter(img) {
      if (!img || img.hasAttribute('data-pdf-dark-mode')) return;
      originalImageStyles.set(img, { filter: img.style.filter || '', backgroundColor: img.style.backgroundColor || '', color: img.style.color || '' });
      img.setAttribute('data-pdf-dark-mode', 'true');
      img.setAttribute('data-pdf-dark-mode-method', 'css');
      img.style.filter = `invert(${window.settings.inversionStrength}%) hue-rotate(180deg) contrast(${window.settings.contrastLevel}%)`;
    }

    function restoreImageOriginal(img) {
      const orig = originalImageStyles.get(img);
      if (orig) {
        img.style.filter = orig.filter;
        img.style.backgroundColor = orig.backgroundColor;
        img.style.color = orig.color;
        originalImageStyles.delete(img);
      } else img.style.filter = '';
      img.removeAttribute('data-pdf-dark-mode');
      img.removeAttribute('data-pdf-dark-mode-method');
    }

    function updateImageFilters() {
      document.querySelectorAll('img[data-pdf-dark-mode="true"]').forEach((img) => {
        img.style.filter = `invert(${window.settings.inversionStrength}%) hue-rotate(180deg) contrast(${window.settings.contrastLevel}%)`;
      });
    }

    function resetImageFilters() {
      document.querySelectorAll('img[data-pdf-dark-mode="true"]').forEach((img) => restoreImageOriginal(img));
    }

    // Mutation observer to watch for dynamic content
    function setupMutationObserver() {
      if (window.pdfDarkModeObserver) return;
      const observer = new MutationObserver((mutations) => {
        let added = false;
        mutations.forEach((m) => {
          if (m.addedNodes && m.addedNodes.length) added = true;
        });
        if (added && window.settings.darkMode) {
          processPdfCanvases();
          processPdfImages();
        }
      });
      observer.observe(document.documentElement || document, { childList: true, subtree: true });
      window.pdfDarkModeObserver = observer;
    }

    // Handle built-in viewers (simple best-effort)
    function handleBuiltInViewers() {
      const embedPdf = document.querySelector('embed[type="application/pdf"]');
      if (embedPdf) applyCssToElement(embedPdf);
      const viewerContainer = document.getElementById('viewerContainer');
      if (viewerContainer) applyCssToElement(viewerContainer);
    }

    // Core functions
    function applyDarkMode() {
      document.documentElement.classList.add('pdf-dark-mode-active');
      injectDarkModeStyle();
      processPdfCanvases();
      processPdfImages();
      setupMutationObserver();
      handleBuiltInViewers();
      startCanvasPolling();
    }

    function removeDarkMode() {
      // Stop any canvas polling that may re-apply styles
      try {
        if (_canvasPollTimer) {
          clearInterval(_canvasPollTimer);
          _canvasPollTimer = null;
        }
      } catch (e) {}

      // Ensure top-level element will animate off by setting an explicit transition
      try {
        document.documentElement.style.transition = 'filter 0.35s ease, background-color 0.35s ease';
      } catch (e) {}

      // Remove the active class to start the transition back to light
      document.documentElement.classList.remove('pdf-dark-mode-active');

      // After transition completes, remove injected styles and restore canvases/images
      setTimeout(() => {
        removeDarkModeStyle();
        // restore canvases and images (these functions may also animate)
        resetCanvasElements();
        resetImageFilters();

        // revert viewer-specific background
        const embed = document.querySelector('embed[type="application/pdf"]');
        if (embed) {
          embed.style.filter = '';
          embed.style.backgroundColor = '';
        }

        document.body.style.backgroundColor = '';
        document.documentElement.style.backgroundColor = '';

        // cleanup transition style
        try { document.documentElement.style.transition = ''; } catch (e) {}
      }, 380);
    }

    // Message handling
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      try {
        if (!request || !request.action) return sendResponse && sendResponse({ status: 'ignored' });

        if (request.action === 'toggleDarkMode') {
          if (typeof request.value === 'boolean') window.settings.darkMode = request.value;
          else window.settings.darkMode = !window.settings.darkMode;

          if (window.settings.darkMode) applyDarkMode();
          else removeDarkMode();

          sendResponse && sendResponse({ status: 'success', darkMode: window.settings.darkMode });
        } else if (request.action === 'updateAllSettings') {
          const s = request.settings || {};
          // Detect change to darkMode so we can apply/remove immediately
          const oldDark = !!window.settings.darkMode;
          const newDark = !!s.darkMode;

          window.settings.inversionStrength = Number(s.inversionStrength) || window.settings.inversionStrength;
          window.settings.contrastLevel = Number(s.contrastLevel) || window.settings.contrastLevel;
          window.settings.darkMode = newDark;

          if (oldDark !== newDark) {
            if (newDark) applyDarkMode();
            else removeDarkMode();
          } else if (newDark) {
            // settings changed while still in dark mode -> update visuals
            updateDarkMode();
          }

          sendResponse && sendResponse({ status: 'success', settings: window.settings });
        } else if (request.action === 'updateSettings') {
          const s = request.settings || {};
          window.settings.inversionStrength = Number(s.inversionStrength) || window.settings.inversionStrength;
          window.settings.contrastLevel = Number(s.contrastLevel) || window.settings.contrastLevel;
          if (window.settings.darkMode) updateDarkMode();
          sendResponse && sendResponse({ status: 'success', settings: window.settings });
        }
      } catch (e) {
        console.error('content script handler error', e);
        sendResponse && sendResponse({ status: 'error', message: String(e) });
      }
      return true; // indicate async response potential
    });

    // Initialize from storage and immediately apply if needed
    function init() {
      chrome.storage.sync.get(['darkMode', 'inversionStrength', 'contrastLevel'], (data) => {
        window.settings.darkMode = data.darkMode !== undefined ? data.darkMode : window.settings.darkMode;
        window.settings.inversionStrength = data.inversionStrength !== undefined ? data.inversionStrength : window.settings.inversionStrength;
        window.settings.contrastLevel = data.contrastLevel !== undefined ? data.contrastLevel : window.settings.contrastLevel;

        if (window.settings.darkMode) applyDarkMode();
      });
    }

    // Run init on DOM ready
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  })();
}
