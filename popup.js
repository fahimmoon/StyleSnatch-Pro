const statusMsg = document.getElementById("statusMsg");
function notify(msg) {
  statusMsg.textContent = msg;
  setTimeout(() => (statusMsg.textContent = ""), 2500);
}

document.getElementById("launchInspectorBtn").onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.url.startsWith("chrome://")) {
    notify("Cannot run on chrome:// pages");
    return;
  }
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["inspector.js"]
  });
  window.close(); 
};

async function runOnTab(func) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.url.startsWith("chrome://")) {
    notify("Cannot run on chrome:// pages");
    return null;
  }
  const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func });
  return results[0]?.result;
}

document.getElementById("xrayBtn").onclick = async () => {
  const active = await runOnTab(() => {
    const existing = document.getElementById("devlens-xray-css");
    if (existing) { existing.remove(); return false; }
    const style = document.createElement("style");
    style.id = "devlens-xray-css";
    style.textContent = `
      * { outline: 1px solid rgba(56, 189, 248, 0.45) !important; }
      div { outline-color: rgba(248, 113, 113, 0.5) !important; }
      section, header, footer, nav, main { outline: 2px solid rgba(74, 222, 128, 0.7) !important; }
    `;
    document.head.appendChild(style);
    return true;
  });
  if (active !== null) {
    document.getElementById("xrayBtn").classList.toggle("active", active);
    notify(active ? "CSS X-Ray ON" : "CSS X-Ray OFF");
  }
};

document.getElementById("editPageBtn").onclick = async () => {
  const isEditing = await runOnTab(() => {
    document.designMode = document.designMode === "on" ? "off" : "on";
    return document.designMode === "on";
  });
  if (isEditing !== null) {
    document.getElementById("editPageBtn").classList.toggle("active", isEditing);
    notify(isEditing ? "Click any text on page to edit!" : "Live Edit disabled");
  }
};

document.getElementById("scanAssetsBtn").onclick = async () => {
  const data = await runOnTab(() => {
    const colors = new Set();
    const fonts = new Set();
    const rgbToHex = (rgb) => {
      const m = rgb.match(/\d+/g);
      if (!m || m.length < 3 || (m[3] !== undefined && Number(m[3]) === 0)) return null;
      return "#" + m.slice(0, 3).map((x) => Number(x).toString(16).padStart(2, "0")).join("");
    };
    Array.from(document.querySelectorAll("*")).slice(0, 400).forEach((el) => {
      const cs = getComputedStyle(el);
      const bg = rgbToHex(cs.backgroundColor);
      const fg = rgbToHex(cs.color);
      if (bg) colors.add(bg);
      if (fg) colors.add(fg);
      const primaryFont = cs.fontFamily.split(",")[0].replace(/['"]/g, "").trim();
      if (primaryFont) fonts.add(primaryFont);
    });
    return { colors: Array.from(colors).slice(0, 16), fonts: Array.from(fonts).slice(0, 5) };
  });

  if (!data) return;
  document.getElementById("paletteBox").style.display = "block";
  const swatchList = document.getElementById("swatchList");
  swatchList.innerHTML = "";
  data.colors.forEach((hex) => {
    const div = document.createElement("div");
    div.className = "swatch";
    div.style.background = hex;
    div.title = `${hex} (Click to copy)`;
    div.onclick = () => { navigator.clipboard.writeText(hex); notify(`Copied ${hex}`); };
    swatchList.appendChild(div);
  });
  
  // Format the fonts, replacing standard delimiters with clear bullet styles
  document.getElementById("fontList").textContent = data.fonts.join(" • ") || "System default";
};

document.getElementById("measureBtn").onclick = async () => {
  const info = await runOnTab(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    domNodes: document.getElementsByTagName("*").length,
    images: document.images.length,
    scripts: document.scripts.length
  }));
  if (!info) return;
  document.getElementById("techBox").style.display = "block";
  document.getElementById("techInfo").innerHTML = `
    <strong>Viewport:</strong> ${info.width}px &times; ${info.height}px<br/>
    <strong>DOM Elements:</strong> ${info.domNodes} nodes<br/>
    <strong>Assets:</strong> ${info.images} images &bull; ${info.scripts} scripts
  `;
};