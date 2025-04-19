# pdf dark mode

a simple chrome extension that transforms bright pdf documents into comfortable dark mode for easier reading. this tool uses color space transformations to create a reading experience that reduces eye strain without sacrificing readability.

## setup

### quick install

1. **gather files**
   - collect all files in a folder named `pdf dark mode`
   - required components:
     - manifest.json - extension configuration
     - popup.html/js - user interface
     - content.js - handles pdf transformation
     - colorUtils.js - color processing library
     - background.js - manages extension behavior
     - styles.css - visual styling

2. **add to chrome**
   - navigate to `chrome://extensions/`
   - enable developer mode (toggle in top right)
   - select "load unpacked"
   - choose your pdf dark mode folder
   - extension added to chrome

3. **access**
   - find the extension icon in your toolbar
   - use the puzzle piece menu to pin if needed
   - now you're ready to transform pdfs

once installed, simply open any pdf in chrome and click the extension icon to activate dark mode.
