(function () {
  // Check if page is raw JSON (e.g., an API endpoint)
  const contentType = document.contentType || "";
  if (!contentType.includes("json")) return;

  const pre = document.querySelector("pre");
  if (!pre) return;

  try {
    const parsed = JSON.parse(pre.textContent);
    const formatted = JSON.stringify(parsed, null, 2);

    document.body.style.cssText = `
      background: #0d1117; color: #c9d1d9; font-family: 'Fira Code', monospace;
      padding: 24px; margin: 0; font-size: 14px; line-height: 1.6;
    `;

    // Syntax highlight keys, strings, numbers, booleans
    const highlighted = formatted
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
        let color = "#79c0ff"; // number
        if (/^"/.test(match)) {
          color = /:$/.test(match) ? "#7ee787" : "#a5d6ff"; // key vs string
        } else if (/true|false/.test(match)) {
          color = "#ff7b72"; // boolean
        } else if (/null/.test(match)) {
          color = "#8b949e";
        }
        return `<span style="color:${color}">${match}</span>`;
      });

    document.body.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid #30363d; font-family:system-ui,sans-serif;">
        <span style="color:#58a6ff; font-weight:700;">DevLens JSON Prettifier</span>
        <button id="devlens-copy-json" style="background:#238636; color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:600;">Copy Formatted JSON</button>
      </div>
      <pre style="margin:0; white-space:pre-wrap; word-break:break-word;">${highlighted}</pre>
    `;

    document.getElementById("devlens-copy-json").onclick = () => {
      navigator.clipboard.writeText(formatted);
      document.getElementById("devlens-copy-json").textContent = "Copied!";
    };
  } catch (e) {
    // Ignore if not valid JSON
  }
})();