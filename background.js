// Listen for extension installation
// no global default darkMode. settings are stored per-tab under key `tab_<id>` in chrome.storage.local

// Listen for tab updates to inject content script when needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab && tab.url) {
    try {
      const url = tab.url.toLowerCase();
      if (url.endsWith('.pdf') || 
          (url.includes('viewer.html') && url.includes('pdf')) ||
          url.includes('pdfviewer')) {
        
        console.log('PDF detected, injecting content script into tab:', tabId);
        
        // Inject the content script and CSS into the tab, then send per-tab settings (if any)
        chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['content.js'] })
          .then(() => {
            // insert CSS (best-effort)
            chrome.scripting.insertCSS({ target: { tabId: tabId }, files: ['styles.css'] }).catch(() => {});
            // fetch per-tab settings and send to the tab so content script applies only for this tab
            const key = `tab_${tabId}`;
            chrome.storage.local.get([key], (data) => {
              const settings = (data && data[key]) ? data[key] : { darkMode: false, inversionStrength: 95, contrastLevel: 100 };
              chrome.tabs.sendMessage(tabId, { action: 'updateAllSettings', settings }, () => {});
            });
          })
          .catch(err => {
            console.error('Error injecting script:', err);
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
      // Read current per-tab setting and toggle only this tab
      const key = `tab_${tab.id}`;
      chrome.storage.local.get([key], (data) => {
        const cur = (data && data[key]) ? data[key] : { darkMode: false, inversionStrength: 95, contrastLevel: 100 };
        const newSettings = Object.assign({}, cur, { darkMode: !cur.darkMode });
        // Persist per-tab
        chrome.storage.local.set({ [key]: newSettings });

        // Try sending message to this tab; if no receiver, inject content script and retry
        chrome.tabs.sendMessage(tab.id, { action: 'toggleDarkMode', value: newSettings.darkMode }, (resp) => {
          if (chrome.runtime.lastError || !resp) {
            chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] })
              .then(() => {
                // small delay to let script initialize, then send full settings
                setTimeout(() => {
                  chrome.tabs.sendMessage(tab.id, { action: 'updateAllSettings', settings: newSettings }, () => {});
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

// respond to content scripts requesting this tab's settings
chrome.runtime.onMessage.addListener((req, sender, sendResp) => {
  try {
    if (!req || !req.action) return;
    if (req.action === 'requestTabSettings') {
      const tabId = (sender && sender.tab && sender.tab.id) || null;
      if (!tabId) return sendResp && sendResp({ settings: { darkMode: false, inversionStrength: 95, contrastLevel: 100 } });
      const key = `tab_${tabId}`;
      chrome.storage.local.get([key], (data) => {
        const settings = (data && data[key]) ? data[key] : { darkMode: false, inversionStrength: 95, contrastLevel: 100 };
        sendResp && sendResp({ settings });
      });
      return true; // async
    }
  } catch (e) {
    console.error('background message handler error', e);
  }
});

// Note: redirecting requests via blocking webRequest is not permitted in MV3 for general extensions.
// If you need to redirect .pdf navigations to a bundled viewer, consider using declarativeNetRequest rules
// or opening the viewer on user action. For now we avoid webRequest blocking listeners.
