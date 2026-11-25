chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-inspector") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || tab.url.startsWith("chrome://")) return;
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["inspector.js"]
    });
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "downloadAsset" && msg.url) {
    chrome.downloads.download({
      url: msg.url,
      filename: msg.filename || "stylesnatch-asset",
      saveAs: false
    });
  }
});