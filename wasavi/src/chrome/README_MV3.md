# Wasavi Chrome Extension (Manifest V3)

This extension has been migrated from Manifest V2 to Manifest V3 for Chrome compatibility.

## Migration Changes

### Key Files Updated
- `manifest.json` - Updated to MV3 format with proper permissions and service worker
- `background.js` - New service worker replacing the old HTML background page
- All content scripts remain unchanged and compatible

### MV3 Updates Made
1. **Background Script**: Converted from `backend/main.html` to `background.js` service worker
2. **Permissions**: Updated permission structure with `host_permissions` for URL access
3. **Web Accessible Resources**: Updated to MV3 format with resource matching
4. **Action**: Added `action` field for extension icon functionality
5. **Modern APIs**: Updated clipboard operations to use `chrome.scripting` API

## How to Test

1. **Load the Extension**:
   - Go to `chrome://extensions` in Chrome
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked" and select `wasavi/src/chrome/`
   - Verify no errors appear

2. **Check Service Worker**:
   - Find "Wasavi (MV3)" in the extensions list
   - Click "service worker" under "Inspect views"
   - Verify console shows initialization messages:
     ```
     Wasavi MV3 installed!
     Initializing Wasavi background...
     Configuration initialized
     Wasavi background initialized
     ```

3. **Test Context Menu**:
   - Go to any webpage with text fields (Gmail, GitHub, etc.)
   - Right-click on a textarea or input field
   - Look for "Edit with Wasavi" in the context menu

4. **Test Editor Functionality**:
   - Click "Edit with Wasavi" to launch the Vi editor
   - Verify the editor opens and functions properly
   - Test basic Vi commands and text editing

## File Structure

```
wasavi/src/chrome/
├── manifest.json          # MV3 configuration
├── background.js          # Service worker (replaces backend/main.html)
├── frontend/              # Content scripts (unchanged)
├── backend/               # Backend libraries (imported by service worker)
├── options.html           # Options page (unchanged)
├── wasavi.html           # Editor frame (unchanged)
└── images/               # Extension icons
```

## Troubleshooting

### Common Issues
- **Extension won't load**: Check console for syntax errors in `background.js`
- **No context menu**: Verify `contextMenus` permission is granted
- **Service worker inactive**: Check if service worker is running in extensions page
- **Clipboard issues**: Ensure `clipboardRead` and `clipboardWrite` permissions are granted

### Debug Steps
1. Check service worker console for errors
2. Verify all imported files exist in `backend/lib/`
3. Test in different websites to isolate issues
4. Check Chrome DevTools for content script errors

## Notes

- The extension maintains full compatibility with the original Wasavi functionality
- Service worker architecture provides better performance and security
- All original features including file system integration and cloud storage remain functional
- The extension now meets Chrome Web Store requirements for MV3

## Version History

- **0.8.0**: Manifest V3 migration
- **0.0.1**: Original Manifest V2 version 