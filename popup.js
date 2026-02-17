document.addEventListener('DOMContentLoaded', function() {
  const darkModeToggle = document.getElementById('darkModeToggle');
  const inversionStrength = document.getElementById('inversionStrength');
  const contrastLevel = document.getElementById('contrastLevel');
  const inversionValue = document.getElementById('inversionValue');
  const contrastValue = document.getElementById('contrastValue');
  
  // Settings object to track changes (per-tab)
  let currentSettings = {
    darkMode: false,
    inversionStrength: 95,
    contrastLevel: 100
  };
  
  // Debounce timer
  let saveTimer = null;
  
  // Load saved settings for the active tab
  function loadSettingsForActiveTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (!tabs || !tabs[0] || !tabs[0].id) return;
      const tabId = tabs[0].id;
      const key = `tab_${tabId}`;
      chrome.storage.local.get([key], function(data) {
        const s = (data && data[key]) ? data[key] : currentSettings;
        currentSettings = {
          darkMode: s.darkMode !== undefined ? s.darkMode : currentSettings.darkMode,
          inversionStrength: s.inversionStrength !== undefined ? s.inversionStrength : currentSettings.inversionStrength,
          contrastLevel: s.contrastLevel !== undefined ? s.contrastLevel : currentSettings.contrastLevel
        };
        // Update UI with loaded settings
        darkModeToggle.checked = currentSettings.darkMode;
        inversionStrength.value = currentSettings.inversionStrength;
        contrastLevel.value = currentSettings.contrastLevel;
        inversionValue.textContent = currentSettings.inversionStrength;
        contrastValue.textContent = currentSettings.contrastLevel;
      });
    });
  }
  loadSettingsForActiveTab();
  
  // Debounced save function to avoid hitting quota limits
  function debouncedSaveSettings(settings) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      // Save settings for the active tab only
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (!tabs || !tabs[0] || !tabs[0].id) return;
        const key = `tab_${tabs[0].id}`;
        chrome.storage.local.set({ [key]: settings });
      });
    }, 500); // Wait 500ms before saving
  }
  
  // Send settings to content script
  function sendSettingsToContentScript() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs && tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'updateAllSettings', settings: currentSettings }, function(response) {
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
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'updateAllSettings', settings: currentSettings }, function(resp) {
                      if (chrome.runtime.lastError) {
                        console.warn('Still no receiver after injection:', chrome.runtime.lastError.message);
                      }
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
    inversionValue.textContent = inversionStrength.value;
    
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
    contrastValue.textContent = contrastLevel.value;
    
    // Update the UI in real-time but don't save on every change
    sendSettingsToContentScript();
  });

  // When popup is opened, refresh UI if user switches tabs while popup is open
  chrome.tabs.onActivated && chrome.tabs.onActivated.addListener(loadSettingsForActiveTab);
  
  // When the slider is released, save the settings
  contrastLevel.addEventListener('change', function() {
    // Save settings (debounced)
    debouncedSaveSettings(currentSettings);
  });
});
