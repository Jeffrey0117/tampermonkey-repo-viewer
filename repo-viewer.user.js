// ==UserScript==
// @name         GitHub Repo Hover README Preview (Enhanced)
// @namespace    http://tampermonkey.net/
// @version      0.4
// @match        https://github.com/*
// @grant        GM_addStyle
// @require      https://cdn.jsdelivr.net/npm/marked/marked.min.js
// ==/UserScript==

(function() {
  'use strict';
  
  // === 自訂 GitHub Token（避免 API 限制，填入自己的 token，沒填就是匿名 60 次/小時） ===
  const GITHUB_TOKEN = ""; 
  
  GM_addStyle(`
    .repo-preview {
      position: absolute;
      z-index: 9999;
      background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
      border-radius: 16px;
      padding: 24px;
      width: 700px;
      max-height: 500px;
      overflow: auto;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 
                  0 3px 12px rgba(0, 0, 0, 0.08),
                  inset 0 1px 0 rgba(255, 255, 255, 0.9);
      display: none;
      font-size: 13px;
      line-height: 1.7;
      border: 1px solid rgba(0, 0, 0, 0.08);
      opacity: 0;
      transform: translateY(-10px) scale(0.95);
      transition: opacity 0.2s ease, transform 0.2s ease;
      backdrop-filter: blur(10px);
    }
    
    .repo-preview.show {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    
    .repo-preview::-webkit-scrollbar {
      width: 8px;
    }
    
    .repo-preview::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.05);
      border-radius: 10px;
    }
    
    .repo-preview::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 10px;
    }
    
    .repo-preview::-webkit-scrollbar-thumb:hover {
      background: rgba(0, 0, 0, 0.3);
    }
    
    .repo-preview * {
      transform: scale(0.92);
      transform-origin: left top;
    }
    
    .repo-preview h1 {
      font-size: 28px;
      margin-top: 0;
      margin-bottom: 16px;
      color: #24292f;
      font-weight: 600;
      border-bottom: 2px solid #e1e4e8;
      padding-bottom: 10px;
    }
    
    .repo-preview h2 {
      font-size: 22px;
      margin-top: 24px;
      margin-bottom: 12px;
      color: #24292f;
      font-weight: 600;
      border-bottom: 1px solid #e1e4e8;
      padding-bottom: 8px;
    }
    
    .repo-preview h3 {
      font-size: 18px;
      margin-top: 20px;
      margin-bottom: 10px;
      color: #24292f;
      font-weight: 600;
    }
    
    .repo-preview p {
      margin: 12px 0;
      color: #57606a;
    }
    
    .repo-preview pre {
      background: #f6f8fa;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      border: 1px solid #d0d7de;
      margin: 16px 0;
    }
    
    .repo-preview code {
      background: #eff1f3;
      padding: 3px 6px;
      border-radius: 6px;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 85%;
      color: #24292f;
    }
    
    .repo-preview pre code {
      background: transparent;
      padding: 0;
      border-radius: 0;
      font-size: 13px;
    }
    
    .repo-preview img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 12px 0;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    .repo-preview a {
      color: #0969da;
      text-decoration: none;
    }
    
    .repo-preview a:hover {
      text-decoration: underline;
    }
    
    .repo-preview ul, .repo-preview ol {
      margin: 12px 0;
      padding-left: 24px;
    }
    
    .repo-preview li {
      margin: 6px 0;
      color: #57606a;
    }
    
    .repo-preview blockquote {
      border-left: 4px solid #d0d7de;
      padding-left: 16px;
      margin: 16px 0;
      color: #57606a;
      font-style: italic;
    }
    
    .repo-preview table {
      border-collapse: collapse;
      width: 100%;
      margin: 16px 0;
    }
    
    .repo-preview th, .repo-preview td {
      border: 1px solid #d0d7de;
      padding: 8px 12px;
      text-align: left;
    }
    
    .repo-preview th {
      background: #f6f8fa;
      font-weight: 600;
    }
    
    .repo-preview hr {
      border: none;
      border-top: 2px solid #e1e4e8;
      margin: 24px 0;
    }
    
    .preview-header {
      font-size: 11px;
      color: #6e7781;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e1e4e8;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  `);

  const preview = document.createElement("div");
  preview.className = "repo-preview";
  document.body.appendChild(preview);

  let hideTimeout;
  let showTimeout;
  let currentLink = null;
  let currentRepo = null;
  let isOverPreview = false;

  async function fetchReadme(owner, repo) {
    const url = `https://api.github.com/repos/${owner}/${repo}/readme`;
    const headers = { "Accept": "application/vnd.github.v3.raw" };
    if (GITHUB_TOKEN) headers["Authorization"] = "token " + GITHUB_TOKEN;
    
    const res = await fetch(url, { headers });
    if (!res.ok) return "📄 No README found or API limit reached.";
    return res.text();
  }

  function showPreview(x, y, immediate = false) {
    clearTimeout(hideTimeout);
    clearTimeout(showTimeout);
    
    preview.style.left = (x + 20) + "px";
    preview.style.top = (y + 20) + "px";
    
    if (preview.style.display === "none") {
      preview.style.display = "block";
      if (immediate) {
        preview.classList.add('show');
      } else {
        setTimeout(() => preview.classList.add('show'), 10);
      }
    }
  }

  function hidePreview(delay = 300) {
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      if (!isOverPreview) {
        preview.classList.remove('show');
        setTimeout(() => {
          if (!isOverPreview) {
            preview.style.display = "none";
            currentLink = null;
            currentRepo = null;
          }
        }, 200);
      }
    }, delay);
  }

  document.addEventListener("mouseover", async (e) => {
    const link = e.target.closest("a[itemprop='name codeRepository']");
    
    if (link) {
      const url = new URL(link.href);
      const [owner, repo] = url.pathname.split("/").filter(Boolean);
      const repoKey = `${owner}/${repo}`;
      
      // 如果是同一个仓库，只更新位置
      if (currentRepo === repoKey) {
        showPreview(e.pageX, e.pageY, true);
        return;
      }
      
      // 切换到新仓库
      currentLink = link;
      currentRepo = repoKey;
      
      // 立即显示预览（如果已经显示则不会闪烁）
      showPreview(e.pageX, e.pageY, preview.style.display !== "none");
      preview.innerHTML = `<div class="preview-header">📖 README Preview</div><em style="color: #6e7781;">Loading README...</em>`;
      
      try {
        const readme = await fetchReadme(owner, repo);
        // 只有在仓库没有改变时才更新内容
        if (currentRepo === repoKey) {
          preview.innerHTML = `<div class="preview-header">📖 ${owner}/${repo}</div>` + marked.parse(readme);
        }
      } catch(err) {
        if (currentRepo === repoKey) {
          preview.innerHTML = `<div class="preview-header">❌ Error</div><span style="color: #cf222e;">Error loading README</span>`;
        }
      }
    }
  });

  document.addEventListener("mouseout", (e) => {
    const link = e.target.closest("a[itemprop='name codeRepository']");
    const relatedTarget = e.relatedTarget;
    
    if (link && !preview.contains(relatedTarget)) {
      // 检查鼠标是否移动到另一个 repo 链接
      const nextLink = relatedTarget?.closest?.("a[itemprop='name codeRepository']");
      if (!nextLink) {
        hidePreview();
      }
    }
  });

  // 鼠标移入预览卡片时取消隐藏
  preview.addEventListener("mouseenter", () => {
    isOverPreview = true;
    clearTimeout(hideTimeout);
  });

  // 鼠标移出预览卡片时隐藏
  preview.addEventListener("mouseleave", () => {
    isOverPreview = false;
    hidePreview();
  });

})();