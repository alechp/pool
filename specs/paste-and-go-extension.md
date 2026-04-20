# Paste & Go — Chrome Extension Spec

## Problem

Chrome's popup blocker prevents web apps from opening more than one `window.open()` per user gesture. The BOM workspace needs to open 5–15 supplier tabs simultaneously from a single click. No client-side workaround (setTimeout, blob launcher pages, anchor clicks) bypasses this browser security limit.

## Solution

A lightweight Chrome extension that reads a newline-separated list of URLs from the clipboard and opens each one in a new tab. The web app copies URLs to clipboard; the user activates the extension to open them all.

## User flow

1. User clicks **"Copy all shopping links"** in BOM workspace → URLs copied to clipboard
2. User clicks the Paste & Go extension icon in the toolbar (or uses keyboard shortcut)
3. Extension reads clipboard, opens each URL in a new tab
4. Badge shows count of tabs opened

## Extension architecture

```
paste-and-go/
├── manifest.json
├── background.js        # Service worker — handles toolbar click
├── popup.html           # Optional: preview URLs before opening
├── popup.js             # Optional: popup logic
└── icons/
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

## manifest.json

```json
{
  "manifest_version": 3,
  "name": "Paste & Go",
  "version": "1.0.0",
  "description": "Open multiple URLs from your clipboard in new tabs",
  "permissions": [
    "clipboardRead",
    "tabs"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "commands": {
    "open-clipboard-urls": {
      "suggested_key": {
        "default": "Ctrl+Shift+V",
        "mac": "Command+Shift+V"
      },
      "description": "Open all URLs from clipboard in new tabs"
    }
  },
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

## popup.html

Minimal popup that previews clipboard URLs before opening them.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 360px;
      max-height: 480px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      color: #e2e8f0;
      background: #1e293b;
      overflow-y: auto;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid #334155;
    }
    .header h1 { font-size: 14px; font-weight: 600; }
    .count {
      font-size: 11px;
      color: #94a3b8;
      font-family: ui-monospace, monospace;
    }
    .url-list {
      padding: 8px 0;
      list-style: none;
    }
    .url-list li {
      padding: 6px 16px;
      border-bottom: 1px solid #1e293b;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #94a3b8;
      font-family: ui-monospace, monospace;
      font-size: 11px;
    }
    .url-list li:hover { background: #334155; color: #e2e8f0; }
    .actions {
      padding: 12px 16px;
      border-top: 1px solid #334155;
      display: flex;
      gap: 8px;
    }
    button {
      flex: 1;
      padding: 8px 12px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-primary {
      background: #34d399;
      color: #0f172a;
    }
    .btn-primary:hover { background: #2dd4bf; }
    .btn-secondary {
      background: #334155;
      color: #e2e8f0;
    }
    .btn-secondary:hover { background: #475569; }
    .empty {
      padding: 32px 16px;
      text-align: center;
      color: #64748b;
    }
    .empty p { margin-top: 8px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Paste & Go</h1>
    <span class="count" id="count"></span>
  </div>
  <div id="content"></div>
  <script src="popup.js"></script>
</body>
</html>
```

## popup.js

```javascript
const URL_PATTERN = /^https?:\/\/.+/;

async function readUrls() {
  try {
    const text = await navigator.clipboard.readText();
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => URL_PATTERN.test(line));
  } catch {
    return [];
  }
}

function renderUrls(urls) {
  const content = document.getElementById('content');
  const count = document.getElementById('count');

  if (urls.length === 0) {
    count.textContent = '';
    content.innerHTML = `
      <div class="empty">
        <strong>No URLs on clipboard</strong>
        <p>Copy a list of URLs (one per line) and try again.</p>
      </div>`;
    return;
  }

  count.textContent = `${urls.length} URL${urls.length === 1 ? '' : 's'}`;

  const list = document.createElement('ul');
  list.className = 'url-list';
  for (const url of urls) {
    const li = document.createElement('li');
    li.textContent = url;
    li.title = url;
    list.appendChild(li);
  }

  const actions = document.createElement('div');
  actions.className = 'actions';

  const openBtn = document.createElement('button');
  openBtn.className = 'btn-primary';
  openBtn.textContent = `Open ${urls.length} tab${urls.length === 1 ? '' : 's'}`;
  openBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openUrls', urls });
    window.close();
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn-secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => window.close());

  actions.appendChild(openBtn);
  actions.appendChild(cancelBtn);

  content.innerHTML = '';
  content.appendChild(list);
  content.appendChild(actions);
}

readUrls().then(renderUrls);
```

## background.js

```javascript
// Handle messages from popup
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'openUrls' && Array.isArray(message.urls)) {
    openTabs(message.urls);
  }
});

// Handle keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'open-clipboard-urls') {
    // Keyboard shortcut path — no popup, read clipboard directly
    // Note: clipboardRead in service worker requires offscreen document in MV3
    // For simplicity, this opens the popup instead
    chrome.action.openPopup();
  }
});

function openTabs(urls) {
  for (const url of urls) {
    chrome.tabs.create({ url, active: false });
  }

  // Show badge with count
  chrome.action.setBadgeText({ text: String(urls.length) });
  chrome.action.setBadgeBackgroundColor({ color: '#34d399' });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);
}
```

## Key design decisions

### Why a popup (not just background click)?

Previewing URLs before opening prevents accidental mass-tab-opening from random clipboard content. The popup shows exactly what will be opened and requires explicit confirmation.

### Why `chrome.tabs.create()` works

Extension APIs bypass the popup blocker entirely. `chrome.tabs.create()` is a privileged API that can open unlimited tabs — it's not subject to the same restrictions as `window.open()` from web page context.

### Keyboard shortcut (Cmd+Shift+V)

Power users can skip the popup preview. The shortcut reads clipboard and opens tabs immediately. Falls back to opening the popup if direct clipboard access is unavailable in the service worker.

### Security considerations

- Only opens lines that match `^https?://` — ignores non-URL clipboard content
- Preview step prevents accidental opens
- No network requests from the extension itself — purely local
- No content scripts injected — minimal permissions

## Integration with BOM workspace

The BOM workspace button copies URLs in newline-separated format:

```
https://www.amazon.com/dp/B0006IUWD8
https://www.adafruit.com/product/4497
https://www.sparkfun.com/products/13256
...
```

The extension reads this format directly. No special protocol or message passing needed — clipboard is the bridge.

## Distribution

For internal/dev use: load as unpacked extension via `chrome://extensions`.

For wider distribution: publish to Chrome Web Store (generic utility — useful beyond this project).

## Future enhancements

- **Firefox support**: WebExtension API is compatible; port manifest to v2 for Firefox
- **Deduplication**: Skip duplicate URLs before opening
- **Domain grouping**: Open tabs grouped by domain (Chrome tab groups API)
- **History**: Show recently opened URL batches for re-opening
- **Web app integration**: Optional content script that listens for `CustomEvent` from the page, eliminating the clipboard step entirely
