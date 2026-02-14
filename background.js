// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.sync.set({
      darkMode: false,
      inversionStrength: 95,
      contrastLevel: 100
    });
  }
});

// Listen for tab updates to inject content script when needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab && tab.url) {
    try {
      const url = tab.url.toLowerCase();
      if (url.endsWith('.pdf') || 
          (url.includes('viewer.html') && url.includes('pdf')) ||
          url.includes('pdfviewer')) {
        
        console.log('PDF detected, injecting content script into tab:', tabId);
        
        // Inject the content script
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        }).catch(err => {
          console.error('Error injecting script:', err);
        });
        
        // Also inject CSS
        chrome.scripting.insertCSS({
          target: { tabId: tabId },
          files: ['styles.css']
        }).catch(err => {
          console.error('Error injecting CSS:', err);
        });
      }
    } catch (error) {
      console.error('Error processing tab update:', error);
    }
  }
});

// Handle extension button click
chrome.action.onClicked.addListener((tab) => {
  if (tab && tab.id) {
    // If the popup is disabled for some reason, toggle dark mode directly
    try {
      // Read current setting and send explicit toggle value to content script
      chrome.storage.sync.get(['darkMode'], (data) => {
        const current = data.darkMode === undefined ? false : data.darkMode;
        const newValue = !current;
        // Persist new value
        chrome.storage.sync.set({ darkMode: newValue });

        // Try sending message; if no receiver, inject content script and retry
        chrome.tabs.sendMessage(tab.id, { action: 'toggleDarkMode', value: newValue }, (resp) => {
          if (chrome.runtime.lastError || !resp) {
            // Inject content script then try again
            chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] })
              .then(() => {
                // small delay to let script initialize
                setTimeout(() => {
                  chrome.tabs.sendMessage(tab.id, { action: 'toggleDarkMode', value: newValue }, () => {});
                }, 150);
              }).catch(err => console.error('Error injecting script on action click:', err));
          }
        });
      });
    } catch (error) {
      console.error('Error sending toggle message:', error);
    }
  }
});

// Note: redirecting requests via blocking webRequest is not permitted in MV3 for general extensions.
// If you need to redirect .pdf navigations to a bundled viewer, consider using declarativeNetRequest rules
// or opening the viewer on user action. For now we avoid webRequest blocking listeners.
