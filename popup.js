document.addEventListener('DOMContentLoaded', function() {
  const darkModeToggle = document.getElementById('darkModeToggle');
  const inversionStrength = document.getElementById('inversionStrength');
  const contrastLevel = document.getElementById('contrastLevel');
  
  // Settings object to track changes
  let currentSettings = {
    darkMode: false,
    inversionStrength: 95,
    contrastLevel: 100
  };
  
  // Debounce timer
  let saveTimer = null;
  
  // Load saved settings
  chrome.storage.sync.get(['darkMode', 'inversionStrength', 'contrastLevel'], function(data) {
    currentSettings = {
      darkMode: data.darkMode !== undefined ? data.darkMode : false,
      inversionStrength: data.inversionStrength !== undefined ? data.inversionStrength : 95,
      contrastLevel: data.contrastLevel !== undefined ? data.contrastLevel : 100
    };
    
    // Update UI with loaded settings
    darkModeToggle.checked = currentSettings.darkMode;
    inversionStrength.value = currentSettings.inversionStrength;
    contrastLevel.value = currentSettings.contrastLevel;
  });
  
  // Debounced save function to avoid hitting quota limits
  function debouncedSaveSettings(settings) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      chrome.storage.sync.set(settings);
    }, 500); // Wait 500ms before saving
  }
  
  // Send settings to content script
  function sendSettingsToContentScript() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs && tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(
          tabs[0].id, 
          { 
            action: 'updateAllSettings', 
            settings: currentSettings 
          },
          function(response) {
            // If no response, the content script might not be loaded
            if (chrome.runtime.lastError || !response) {
              console.log('No response from content script, injecting it');
              try {
                // Inject the content script if it's not already there
                chrome.scripting.executeScript({
                  target: { tabId: tabs[0].id },
                  files: ['content.js']
                }).then(() => {
                  // Try sending the message again after script is injected
                  setTimeout(() => {
                    chrome.tabs.sendMessage(tabs[0].id, { 
                      action: 'updateAllSettings', 
                      settings: currentSettings
                    });
                  }, 100);
                });
              } catch (err) {
                console.error('Error injecting script:', err);
              }
            }
          }
        );
      }
    });
  }
  
  // Save settings when changed
  darkModeToggle.addEventListener('change', function() {
    currentSettings.darkMode = darkModeToggle.checked;
    
    // Save settings (debounced)
    debouncedSaveSettings(currentSettings);
    
    // Send message to content script
    sendSettingsToContentScript();
  });
  
  // Use 'input' event instead of 'change' for real-time updates while sliding
  inversionStrength.addEventListener('input', function() {
    currentSettings.inversionStrength = inversionStrength.value;
    
    // Update the UI in real-time but don't save on every change
    sendSettingsToContentScript();
  });
  
  // When the slider is released, save the settings
  inversionStrength.addEventListener('change', function() {
    // Save settings (debounced)
    debouncedSaveSettings(currentSettings);
  });
  
  // Use 'input' event instead of 'change' for real-time updates while sliding
  contrastLevel.addEventListener('input', function() {
    currentSettings.contrastLevel = contrastLevel.value;
    
    // Update the UI in real-time but don't save on every change
    sendSettingsToContentScript();
  });
  
  // When the slider is released, save the settings
  contrastLevel.addEventListener('change', function() {
    // Save settings (debounced)
    debouncedSaveSettings(currentSettings);
  });
});
