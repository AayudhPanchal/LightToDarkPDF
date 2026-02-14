# pdf dark mode

a simple chrome extension that transforms bright pdf documents into comfortable dark mode for easier reading. this tool uses color space transformations to create a reading experience that reduces eye strain without sacrificing readability.

## setup

### quick install

1. **gather files**
   - clone the repository:
   ```
   git clone https://github.com/AayudhPanchal/LightToDarkPDF.git
   ```
   - ensure all required files are present:

   ```
   PDF Dark Mode/
   ├── manifest.json     # extension configuration
   ├── popup.html        # user interface
   ├── popup.js          # interface functionality
   ├── content.js        # pdf transformation logic
   ├── colorUtils.js     # color processing library
   ├── background.js     # extension management
   ├── styles.css        # visual styling
   └── README.md         # documentation
   ```

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