// Content script for Studocu Getter
console.log("Studocu Getter content script loaded");

function getUniqueFilename(url, extension = ".pdf") {
  // Extract the file name from the given URL
  const match = url.match(/\/([^\/]+?)\/\d+\?/);
  const baseName = match ? match[1] : "output_document";
  return `${baseName}${extension}`;
}

function extractImageData() {
  const pageElements = document.querySelectorAll("div[data-page-index]");
  const totalPages = pageElements.length;

  if (!totalPages) throw new Error("No pages found");

  const img = pageElements[0].querySelector("img");
  if (!img?.src) throw new Error("No image found");

  const [, basePrefix, , baseSuffix] = img.src.match(
    /(.*?\/bg)(\d+)(\.png\?.*)/
  );

  return {
    totalPages,
    basePrefix,
    baseSuffix,
    filename:
      window.location.href.match(/\/([^\/]+?)\/\d+\?/)?.[1] || "document",
  };
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Received message:", request);

  if (request.action === "downloadPDF") {
    try {
      sendResponse({ success: true, data: extractImageData() });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  return true; // Keep message channel open for async response
});

// Optional: Add a visual indicator when the extension is active
function addExtensionIndicator() {
  // Check if we're on a StudoCu document page
  if (
    !window.location.href.includes("studocu.com/") ||
    !window.location.href.includes("/document/")
  ) {
    return;
  }

  // Check if indicator already exists
  if (document.getElementById("studocu-pdf-indicator")) {
    return;
  }

  const indicator = document.createElement("div");
  indicator.id = "studocu-pdf-indicator";
  indicator.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 10000;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      font-family: Arial, sans-serif;
    ">
      📄 PDF Downloader Ready
    </div>
  `;

  document.body.appendChild(indicator);

  // Remove indicator after 3 seconds
  setTimeout(() => {
    const el = document.getElementById("studocu-pdf-indicator");
    if (el) el.remove();
  }, 3000);
}

// Add indicator when page loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", addExtensionIndicator);
} else {
  addExtensionIndicator();
}
