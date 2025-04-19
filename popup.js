document.addEventListener('DOMContentLoaded', function() {
  const darkModeToggle = document.getElementById('darkModeToggle');
  const inversionStrength = document.getElementById('inversionStrength');
  const contrastLevel = document.getElementById('contrastLevel');
  
  // Load saved settings
  chrome.storage.sync.get(['darkMode', 'inversionStrength', 'contrastLevel'], function(data) {
    darkModeToggle.checked = data.darkMode !== undefined ? data.darkMode : false;
    inversionStrength.value = data.inversionStrength !== undefined ? data.inversionStrength : 95;
    contrastLevel.value = data.contrastLevel !== undefined ? data.contrastLevel : 100;
  });
  
  // Save settings when changed
  darkModeToggle.addEventListener('change', function() {
    const isDarkMode = darkModeToggle.checked;
    chrome.storage.sync.set({ darkMode: isDarkMode });
    
    // Send message to content script with a callback to confirm receipt
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs && tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(
          tabs[0].id, 
          { 
            action: 'toggleDarkMode', 
            value: isDarkMode 
          },
          function(response) {
            console.log('Toggle response:', response);
            // If no response, the content script might not be loaded
            if (chrome.runtime.lastError || !response) {
              console.log('No response from content script, injecting it');
              // Inject the content script if it's not already there
              chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ['content.js']
              });
            }
          }
        );
      }
    });
  });
  
  // Use 'input' event instead of 'change' for real-time updates while sliding
  inversionStrength.addEventListener('input', function() {
    chrome.storage.sync.set({ inversionStrength: inversionStrength.value });
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { 
        action: 'updateSettings', 
        settings: {
          inversionStrength: inversionStrength.value,
          contrastLevel: contrastLevel.value
        }
      });
    });
  });
  
  // Use 'input' event instead of 'change' for real-time updates while sliding
  contrastLevel.addEventListener('input', function() {
    chrome.storage.sync.set({ contrastLevel: contrastLevel.value });
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { 
        action: 'updateSettings', 
        settings: {
          inversionStrength: inversionStrength.value, // Fixed: was incorrectly using contrastLevel.value
          contrastLevel: contrastLevel.value
        }
      });
    });
  });
});
