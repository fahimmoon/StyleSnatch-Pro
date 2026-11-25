(function () {
  if (window.__styleSnatchActive) {
    window.__styleSnatchCleanup();
    return;
  }
  window.__styleSnatchActive = true;

  // Spacing highlight overlays
  const marginBox = document.createElement("div");
  marginBox.style.cssText = `
    position: fixed; pointer-events: none; z-index: 2147483645;
    background: rgba(251, 146, 60, 0.18); border: 1px dashed #fb923c;
    display: none; transition: all 0.05s ease-out; box-sizing: border-box;
  `;

  const highlightBox = document.createElement("div");
  highlightBox.style.cssText = `
    position: fixed; pointer-events: none; z-index: 2147483646;
    border: 2px solid #38bdf8; background: rgba(56, 189, 248, 0.14);
    border-radius: 3px; transition: all 0.05s ease-out; display: none; box-sizing: border-box;
  `;

  const card = document.createElement("div");
  card.style.cssText = `
    position: fixed; z-index: 2147483647; width: 385px; max-height: 510px;
    overflow-y: auto; background: #0b0f17; color: #f8fafc;
    border: 1px solid #1f2937; border-radius: 12px; padding: 14px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;
    box-shadow: 0 24px 48px rgba(0,0,0,0.75); pointer-events: none; display: none;
    box-sizing: border-box;
  `;

  document.body.appendChild(marginBox);
  document.body.appendChild(highlightBox);
  document.body.appendChild(card);

  const RELEVANT_PROPS = [
    "display", "position", "flex-direction", "justify-content", "align-items", "gap",
    "grid-template-columns", "width", "height", "padding", "margin",
    "font-family", "font-size", "font-weight", "line-height", "text-align",
    "color", "background-color", "background-image", "border", "border-radius", "box-shadow"
  ];

  const IGNORE_VALUES = new Set([
    "none", "normal", "auto", "0px", "static", "row", "stretch",
    "start", "rgba(0, 0, 0, 0)", "transparent", "0px none rgb(0, 0, 0)"
  ]);

  let locked = false;
  let currentEl = null;
  let activeTab = "css"; 

  function detectAsset(el) {
    if (!el) return null;
    const svg = el.tagName.toLowerCase() === "svg" ? el : el.closest("svg");
    if (svg) {
      const clone = svg.cloneNode(true);
      if (!clone.getAttribute("xmlns")) {
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      }
      const svgCode = new XMLSerializer().serializeToString(clone);
      const dataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgCode);
      return { type: "svg", code: svgCode, url: dataUrl, filename: "icon.svg" };
    }
    if (el.tagName.toLowerCase() === "img" && el.currentSrc) {
      const cleanName = el.currentSrc.split("/").pop().split("?")[0] || "image.png";
      return { type: "image", url: el.currentSrc, filename: cleanName };
    }
    const bg = getComputedStyle(el).backgroundImage;
    const match = bg && bg.match(/url\(["']?(.*?)["']?\)/);
    if (match && match[1]) {
      const cleanName = match[1].split("/").pop().split("?")[0] || "bg-image.png";
      return { type: "bg-image", url: match[1], filename: cleanName };
    }
    return null;
  }

  function extractCleanCSS(el) {
    const cs = getComputedStyle(el);
    const lines = [];
    for (const prop of RELEVANT_PROPS) {
      const val = cs.getPropertyValue(prop).trim();
      if (!val || IGNORE_VALUES.has(val)) continue;
      if (prop === "background-image" && val === "none") continue;
      if (prop === "border" && val.startsWith("0px")) continue;
      lines.push(`  ${prop}: ${val};`);
    }
    const selector = el.id
      ? `#${el.id}`
      : el.className && typeof el.className === "string" && el.className.trim()
      ? `.${el.className.trim().split(/\s+/)[0]}`
      : el.tagName.toLowerCase();

    return `${selector} {\n${lines.join("\n")}\n}`;
  }

  function extractFormattedHTML(el) {
    const raw = el.outerHTML;
    let formatted = "";
    let indent = 0;
    raw.replace(/>\s*</g, ">\n<").split("\n").forEach((line) => {
      if (line.match(/^<\/\w/)) indent = Math.max(0, indent - 1);
      formatted += "  ".repeat(indent) + line.trim() + "\n";
      if (line.match(/^<\w[^>]*[^\/]>.*$/) && !line.includes("</")) indent++;
    });
    return formatted.trim();
  }

  function extractTailwind(el) {
    const cs = getComputedStyle(el);
    const classes = [];
    if (cs.display === "flex") classes.push("flex");
    if (cs.display === "grid") classes.push("grid");
    if (cs.display === "inline-flex") classes.push("inline-flex");
    if (cs.flexDirection === "column") classes.push("flex-col");
    if (cs.justifyContent === "center") classes.push("justify-center");
    if (cs.justifyContent === "space-between") classes.push("justify-between");
    if (cs.alignItems === "center") classes.push("items-center");
    if (cs.gap && cs.gap !== "normal" && cs.gap !== "0px") classes.push(`gap-[${cs.gap}]`);
    if (cs.padding && cs.padding !== "0px") classes.push(`p-[${cs.padding.replace(/\s+/g, "_")}]`);
    if (cs.margin && cs.margin !== "0px") classes.push(`m-[${cs.margin.replace(/\s+/g, "_")}]`);
    if (cs.fontSize) classes.push(`text-[${cs.fontSize}]`);
    if (Number(cs.fontWeight) >= 700) classes.push("font-bold");
    else if (Number(cs.fontWeight) >= 600) classes.push("font-semibold");
    if (cs.borderRadius && cs.borderRadius !== "0px") classes.push(`rounded-[${cs.borderRadius}]`);
    if (cs.color) classes.push(`text-[${cs.color.replace(/\s+/g, "")}]`);
    if (cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)") {
      classes.push(`bg-[${cs.backgroundColor.replace(/\s+/g, "")}]`);
    }
    const tag = el.tagName.toLowerCase();
    return `<${tag} class="${classes.join(" ")}">\n  ...\n</${tag}>`;
  }

  function escapeHTML(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function updateHighlight(el) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const mt = parseFloat(cs.marginTop) || 0;
    const mr = parseFloat(cs.marginRight) || 0;
    const mb = parseFloat(cs.marginBottom) || 0;
    const ml = parseFloat(cs.marginLeft) || 0;

    marginBox.style.display = "block";
    marginBox.style.left = `${rect.left - ml}px`;
    marginBox.style.top = `${rect.top - mt}px`;
    marginBox.style.width = `${rect.width + ml + mr}px`;
    marginBox.style.height = `${rect.height + mt + mb}px`;

    highlightBox.style.display = "block";
    highlightBox.style.left = `${rect.left}px`;
    highlightBox.style.top = `${rect.top}px`;
    highlightBox.style.width = `${rect.width}px`;
    highlightBox.style.height = `${rect.height}px`;
  }

  function getActiveCode(el, asset) {
    if (activeTab === "asset" && asset) {
      return asset.type === "svg" ? asset.code : asset.url;
    }
    if (activeTab === "html") return extractFormattedHTML(el);
    if (activeTab === "tailwind") return extractTailwind(el);
    return extractCleanCSS(el);
  }

  function renderCard(el, isLocked) {
    const asset = detectAsset(el);
    if (!asset && activeTab === "asset") activeTab = "css";

    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const tag = el.tagName.toLowerCase();
    const cls = el.className && typeof el.className === "string"
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
      : "";

    const codeContent = getActiveCode(el, asset);

    const tabStyle = (tabName, highlight = false) => `
      padding: 4px 9px; border-radius: 6px; border: none; font-size: 11px; font-weight: 700; cursor: pointer;
      background: ${activeTab === tabName ? (highlight ? "#10b981" : "#0284c7") : "#1e293b"};
      color: ${activeTab === tabName ? (highlight ? "#052e16" : "#ffffff") : (highlight ? "#34d399" : "#94a3b8")};
    `;

    card.style.pointerEvents = isLocked ? "auto" : "none";
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid #1e293b; box-sizing: border-box;">
        <span style="color:#38bdf8; font-weight:700; max-width:215px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display: flex; align-items: center; gap: 4px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="#0284c7"/>
            <circle cx="12" cy="7" r="1.5" fill="#ffffff"/>
            <path d="M10.5 11h2v6.5h1.5M10.5 11h-1" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
          </svg>
          &lt;${tag}${cls}&gt;
        </span>
        <span style="color:#94a3b8; font-size:11px;">${Math.round(rect.width)} &times; ${Math.round(rect.height)}px</span>
      </div>

      <div style="display:flex; gap:6px; margin-bottom:8px; font-size:10.5px; font-family:system-ui,sans-serif; box-sizing: border-box;">
        <span style="background:#fb923c22; color:#fb923c; padding:2px 7px; border-radius:4px;">Margin: ${cs.margin}</span>
        <span style="background:#4ade8022; color:#4ade80; padding:2px 7px; border-radius:4px;">Padding: ${cs.padding}</span>
        ${asset ? `<span style="background:#a855f722; color:#c084fc; padding:2px 7px; border-radius:4px; font-weight:700;">${asset.type.toUpperCase()}</span>` : ""}
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-family:system-ui,sans-serif; box-sizing: border-box;">
        <div style="display:flex; gap:4px;">
          <button id="tab-css" style="${tabStyle("css")}">CSS</button>
          <button id="tab-html" style="${tabStyle("html")}">HTML</button>
          <button id="tab-tw" style="${tabStyle("tailwind")}">Tailwind</button>
          ${asset ? `<button id="tab-asset" style="${tabStyle("asset", true)}">${asset.type === "svg" ? "SVG Icon" : "Image"}</button>` : ""}
        </div>
        ${
          isLocked
            ? `<div style="display:flex; gap:4px; box-sizing: border-box;">
                 <button id="ss-parent" style="background:#1e293b; color:#e2e8f0; border:1px solid #334155; padding:3px 7px; border-radius:5px; cursor:pointer; font-size:11px;">&uarr; Parent</button>
                 <button id="ss-child" style="background:#1e293b; color:#e2e8f0; border:1px solid #334155; padding:3px 7px; border-radius:5px; cursor:pointer; font-size:11px;">&darr; Child</button>
               </div>`
            : ""
        }
      </div>

      ${
        activeTab === "asset" && asset
          ? `<div style="background:#1e293b; padding:10px; border-radius:8px; margin-bottom:8px; text-align:center; box-sizing: border-box;">
               <img src="${asset.url}" style="max-height:70px; max-width:100%; object-fit:contain;" />
             </div>`
          : ""
      }

      <pre style="margin:0 0 10px; max-height:190px; overflow:auto; background:#070a13; padding:10px; border-radius:8px; border:1px solid #1e293b; white-space:pre-wrap; word-break:break-all; color:#e2e8f0; line-height:1.45; font-size:11.5px; box-sizing: border-box;">${escapeHTML(codeContent)}</pre>

      ${
        isLocked
          ? `<div style="display:flex; gap:6px; flex-wrap:wrap; font-family:system-ui,sans-serif; box-sizing: border-box;">
               <button id="ss-copy-active" style="flex:1; background:#0284c7; color:#fff; border:none; padding:8px; border-radius:6px; font-weight:700; cursor:pointer;">
                 Copy ${activeTab === "asset" ? (asset.type === "svg" ? "SVG Code" : "Image URL") : activeTab.toUpperCase()}
               </button>
               ${
                 asset
                   ? `<button id="ss-save-asset" style="flex:1; background:#a855f7; color:#fff; border:none; padding:8px; border-radius:6px; font-weight:700; cursor:pointer;">Save ${asset.type === "svg" ? ".SVG" : "Image"}</button>`
                   : `<button id="ss-copy-both" style="flex:1; background:#10b981; color:#052e16; border:none; padding:8px; border-radius:6px; font-weight:700; cursor:pointer;">HTML+CSS</button>`
               }
               <button id="ss-codepen" style="background:#334155; color:#fff; border:none; padding:8px 10px; border-radius:6px; font-weight:600; cursor:pointer;">CodePen</button>
               <button id="ss-resume" style="background:#1e293b; color:#94a3b8; border:1px solid #334155; padding:8px 10px; border-radius:6px; cursor:pointer;">Resume</button>
             </div>`
          : `<div style="font-family:system-ui,sans-serif; font-size:11px; color:#38bdf8; text-align:center; box-sizing: border-box; border-top: 1px solid #1e293b; padding-top: 8px;">Click to lock, copy or save assets • Alt+Shift+S / ESC to exit</div>`
      }
    `;

    document.getElementById("tab-css").onclick = (e) => { e.stopPropagation(); activeTab = "css"; renderCard(el, isLocked); };
    document.getElementById("tab-html").onclick = (e) => { e.stopPropagation(); activeTab = "html"; renderCard(el, isLocked); };
    document.getElementById("tab-tw").onclick = (e) => { e.stopPropagation(); activeTab = "tailwind"; renderCard(el, isLocked); };
    if (asset && document.getElementById("tab-asset")) {
      document.getElementById("tab-asset").onclick = (e) => { e.stopPropagation(); activeTab = "asset"; renderCard(el, isLocked); };
    }

    if (isLocked) {
      document.getElementById("ss-parent").onclick = (e) => {
        e.stopPropagation();
        if (el.parentElement && el.parentElement !== document.documentElement) {
          currentEl = el.parentElement;
          updateHighlight(currentEl);
          renderCard(currentEl, true);
        }
      };
      document.getElementById("ss-child").onclick = (e) => {
        e.stopPropagation();
        if (el.firstElementChild) {
          currentEl = el.firstElementChild;
          updateHighlight(currentEl);
          renderCard(currentEl, true);
        }
      };
      document.getElementById("ss-copy-active").onclick = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(codeContent);
        e.target.textContent = "Copied!";
      };
      if (asset && document.getElementById("ss-save-asset")) {
        document.getElementById("ss-save-asset").onclick = (e) => {
          e.stopPropagation();
          chrome.runtime.sendMessage({
            action: "downloadAsset",
            url: asset.url,
            filename: asset.filename
          });
          e.target.textContent = "Saved!";
        };
      }
      if (document.getElementById("ss-copy-both")) {
        document.getElementById("ss-copy-both").onclick = (e) => {
          e.stopPropagation();
          const combined = `<!-- HTML -->\n${extractFormattedHTML(el)}\n\n/* CSS */\n${extractCleanCSS(el)}`;
          navigator.clipboard.writeText(combined);
          e.target.textContent = "Copied!";
        };
      }
      document.getElementById("ss-codepen").onclick = (e) => {
        e.stopPropagation();
        const form = document.createElement("form");
        form.action = "https://codepen.io/pen/define";
        form.method = "POST";
        form.target = "_blank";
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = "data";
        input.value = JSON.stringify({
          title: `StyleSnatch Extract: <${tag}>`,
          html: extractFormattedHTML(el),
          css: extractCleanCSS(el)
        });
        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
        form.remove();
      };
      document.getElementById("ss-resume").onclick = (e) => {
        e.stopPropagation();
        locked = false;
        card.style.pointerEvents = "none";
      };
    }
  }

  function positionCard(x, y) {
    const pad = 16;
    const cardW = 395;
    const cardH = card.offsetHeight || 360;
    const left = x + cardW + pad > window.innerWidth ? Math.max(10, x - cardW - pad) : x + pad;
    const top = y + cardH + pad > window.innerHeight ? Math.max(10, window.innerHeight - cardH - pad) : y + pad;
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  }

  const onMouseMove = (e) => {
    if (locked) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === highlightBox || el === marginBox || el === card || card.contains(el)) return;

    currentEl = el;
    if (detectAsset(el)) activeTab = "asset";
    else if (activeTab === "asset") activeTab = "css";

    updateHighlight(el);
    card.style.display = "block";
    renderCard(el, false);
    positionCard(e.clientX, e.clientY);
  };

  const onClick = (e) => {
    if (card.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    if (!currentEl) return;

    locked = true;
    const asset = detectAsset(currentEl);
    renderCard(currentEl, true);
    navigator.clipboard.writeText(getActiveCode(currentEl, asset));
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") window.__styleSnatchCleanup();
    if (!currentEl) return;
    if (e.key === "ArrowUp" && currentEl.parentElement && currentEl.parentElement !== document.documentElement) {
      e.preventDefault();
      locked = true;
      currentEl = currentEl.parentElement;
      updateHighlight(currentEl);
      renderCard(currentEl, true);
    } else if (e.key === "ArrowDown" && currentEl.firstElementChild) {
      e.preventDefault();
      locked = true;
      currentEl = currentEl.firstElementChild;
      updateHighlight(currentEl);
      renderCard(currentEl, true);
    }
  };

  document.addEventListener("mousemove", onMouseMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeyDown, true);

  window.__styleSnatchCleanup = () => {
    document.removeEventListener("mousemove", onMouseMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
    marginBox.remove();
    highlightBox.remove();
    card.remove();
    window.__styleSnatchActive = false;
  };
})();