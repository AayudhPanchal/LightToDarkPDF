// Load the color utilities
let ColorUtils = null;

function loadColorUtils() {
  return new Promise((resolve) => {
    if (ColorUtils) {
      resolve(ColorUtils);
      return;
    }
    
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('colorUtils.js');
    script.onload = function() {
      ColorUtils = window.ColorUtils;
      resolve(ColorUtils);
    };
    document.head.appendChild(script);
  });
}

// Settings with defaults
let settings = {
  darkMode: false,
  inversionStrength: 95,
  contrastLevel: 100
};

// Track if we've been initialized
let initialized = false;

// Initialize the extension
function init() {
  if (initialized) return;
  initialized = true;
  
  console.log("PDF Dark Mode extension initialized");
  
  // Load saved settings
  chrome.storage.sync.get(['darkMode', 'inversionStrength', 'contrastLevel'], (data) => {
    settings = {
      darkMode: data.darkMode !== undefined ? data.darkMode : false,
      inversionStrength: data.inversionStrength !== undefined ? data.inversionStrength : 95,
      contrastLevel: data.contrastLevel !== undefined ? data.contrastLevel : 100
    };
    
    console.log("Settings loaded:", settings);
    
    // Apply dark mode immediately if it's enabled in settings
    if (settings.darkMode) {
      applyDarkMode();
    }
  });

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Message received in content script:", request);
    
    if (request.action === 'toggleDarkMode') {
      console.log("Toggling dark mode to:", request.value);
      settings.darkMode = request.value;
      
      if (settings.darkMode) {
        applyDarkMode();
      } else {
        removeDarkMode();
      }
      
      // Send response to confirm receipt
      sendResponse({ status: 'success', darkMode: settings.darkMode });
    } 
    else if (request.action === 'updateSettings') {
      settings.inversionStrength = request.settings.inversionStrength;
      settings.contrastLevel = request.settings.contrastLevel;
      
      if (settings.darkMode) {
        updateDarkMode();
      }
      
      sendResponse({ status: 'success', settings: settings });
    }
    
    // Return true to indicate we'll respond asynchronously
    return true;
  });
}

// Apply dark mode to PDF
function applyDarkMode() {
  console.log("Applying dark mode with settings:", settings);
  
  // Add dark mode class to document
  document.documentElement.classList.add('pdf-dark-mode-active');
  
  // Apply styles through CSS
  injectDarkModeStyle();
  
  // Handle direct canvas manipulation for PDF.js
  processPdfCanvases();
  
  // Start observing for dynamically added content
  setupMutationObserver();
  
  // Special handling for built-in PDF viewers
  handleBuiltInViewers();
}

// Update dark mode settings in real-time
function updateDarkMode() {
  console.log("Updating dark mode with settings:", settings);
  
  // Update the CSS styles
  const styleElement = document.getElementById('pdf-dark-mode-style');
  if (styleElement) {
    styleElement.textContent = generateDarkModeCSS();
  } else {
    // If style element doesn't exist, create it
    injectDarkModeStyle();
  }
  
  // Update any canvas elements
  updateCanvasFilters();
}

// Remove dark mode
function removeDarkMode() {
  console.log("Removing dark mode");
  
  // Remove dark mode class
  document.documentElement.classList.remove('pdf-dark-mode-active');
  
  // Remove injected styles
  const styleElement = document.getElementById('pdf-dark-mode-style');
  if (styleElement) {
    styleElement.remove();
  }
  
  // Reset canvas elements
  resetCanvasFilters();
  
  // Remove any attribute-based styles
  document.querySelectorAll('[data-pdf-dark-mode]').forEach(el => {
    el.removeAttribute('data-pdf-dark-mode');
    el.style.filter = '';
  });
}

// Generate the CSS for dark mode
function generateDarkModeCSS() {
  return `
    /* PDF dark mode styles */
    html.pdf-dark-mode-active {
      background-color: #292929 !important;
    }
    
    /* Main content inversion */
    html.pdf-dark-mode-active embed[type="application/pdf"],
    html.pdf-dark-mode-active object[type="application/pdf"],
    html.pdf-dark-mode-active .pdfViewer,
    html.pdf-dark-mode-active #viewer,
    html.pdf-dark-mode-active #viewerContainer,
    html.pdf-dark-mode-active #outerContainer,
    html.pdf-dark-mode-active .textLayer,
    html.pdf-dark-mode-active .canvasWrapper,
    html.pdf-dark-mode-active [data-pdf-dark-mode] {
      filter: invert(${settings.inversionStrength}%) hue-rotate(180deg) contrast(${settings.contrastLevel}%) !important;
      transition: filter 0.2s ease-in-out;
    }
    
    /* Ensure images in PDFs look correct by double-inverting them */
    html.pdf-dark-mode-active .pdfViewer img,
    html.pdf-dark-mode-active #viewer img,
    html.pdf-dark-mode-active embed[type="application/pdf"] img {
      filter: invert(100%) hue-rotate(180deg) !important;
    }
    
    /* Background colors */
    html.pdf-dark-mode-active body,
    html.pdf-dark-mode-active .pdfViewer .page,
    html.pdf-dark-mode-active #viewer .page {
      background-color: #292929 !important;
    }
  `;
}

// Inject dark mode CSS
function injectDarkModeStyle() {
  // Don't duplicate if already present
  if (document.getElementById('pdf-dark-mode-style')) {
    return;
  }
  
  const styleElement = document.createElement('style');
  styleElement.id = 'pdf-dark-mode-style';
  styleElement.textContent = generateDarkModeCSS();
  document.head.appendChild(styleElement);
}

// Process all PDF canvas elements
function processPdfCanvases() {
  const canvases = document.querySelectorAll('canvas');
  canvases.forEach(applyCanvasFilter);
}

// Apply filter to a single canvas
function applyCanvasFilter(canvas) {
  if (!canvas.hasAttribute('data-pdf-dark-mode')) {
    canvas.setAttribute('data-pdf-dark-mode', 'true');
    canvas.style.filter = `invert(${settings.inversionStrength}%) hue-rotate(180deg) contrast(${settings.contrastLevel}%)`;
  }
}

// Update filters on existing canvases
function updateCanvasFilters() {
  document.querySelectorAll('[data-pdf-dark-mode="true"]').forEach(element => {
    element.style.filter = `invert(${settings.inversionStrength}%) hue-rotate(180deg) contrast(${settings.contrastLevel}%)`;
  });
}

// Reset filters on canvases
function resetCanvasFilters() {
  document.querySelectorAll('[data-pdf-dark-mode="true"]').forEach(element => {
    element.style.filter = '';
    element.removeAttribute('data-pdf-dark-mode');
  });
}

// Set up observer for dynamically added content
function setupMutationObserver() {
  // Don't create multiple observers
  if (window.pdfDarkModeObserver) return;
  
  const observer = new MutationObserver((mutations) => {
    let needsProcessing = false;
    
    mutations.forEach(mutation => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Check if any new canvas elements or PDF viewers were added
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if this node is or contains a canvas/PDF viewer
            if (node.nodeName === 'CANVAS' || 
                node.nodeName === 'EMBED' && node.type === 'application/pdf' ||
                node.querySelector('canvas, embed[type="application/pdf"]')) {
              needsProcessing = true;
            }
          }
        });
      }
    });
    
    if (needsProcessing && settings.darkMode) {
      // Process any new canvas elements
      processPdfCanvases();
    }
  });
  
  // Start observing the document with the configured parameters
  observer.observe(document.documentElement, {
    childList: true, 
    subtree: true
  });
  
  window.pdfDarkModeObserver = observer;
}

// Handle special cases for built-in PDF viewers
function handleBuiltInViewers() {
  // Chrome's built-in PDF viewer is usually in an iframe or embed tag
  const embedPdf = document.querySelector('embed[type="application/pdf"]');
  if (embedPdf) {
    embedPdf.setAttribute('data-pdf-dark-mode', 'true');
    embedPdf.style.filter = `invert(${settings.inversionStrength}%) hue-rotate(180deg) contrast(${settings.contrastLevel}%)`;
  }
  
  // Firefox's built-in PDF viewer
  const viewerContainer = document.getElementById('viewerContainer');
  if (viewerContainer) {
    viewerContainer.setAttribute('data-pdf-dark-mode', 'true');
    viewerContainer.style.filter = `invert(${settings.inversionStrength}%) hue-rotate(180deg) contrast(${settings.contrastLevel}%)`;
  }
}

// Initialize the extension
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Init immediately to make sure we're ready for messages
init();
