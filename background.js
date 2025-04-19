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
      chrome.tabs.sendMessage(tab.id, { action: 'toggleDarkMode' });
    } catch (error) {
      console.error('Error sending toggle message:', error);
    }
  }
});
