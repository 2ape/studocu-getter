let isDownloading = false;
const els = {
  status: document.getElementById("status"),
  downloadBtn: document.getElementById("downloadBtn"),
  progress: {
    container: document.getElementById("progressContainer"),
    bar: document.getElementById("progressBar"),
    text: document.getElementById("progressText"),
  },
  details: document.getElementById("details"),
  counter: document.getElementById("counter-api"),
};

const updateUI = {
  status: (message, type = "info") => {
    els.status.textContent = message;
    els.status.className = `status ${type}`;
  },
  progress: (current, total, message) => {
    const percent = Math.round((current / total) * 100);
    els.progress.bar.style.width = `${percent}%`;
    els.progress.text.textContent = `${message} (${current}/${total})`;
  },
  counter: (count) => {
    els.counter.textContent = `PDFs unlocked: ${count}`;
  },
};

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch("https://studocu.hrmods.online/api/pdf-count");
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    const data = await res.json();
    if (data.count !== undefined) {
      updateUI.counter(data.count);
    } else {
      els.counter.textContent = "Failed to load count";
    }
  } catch (error) {
    console.error("Error fetching PDF count:", error);
    els.counter.textContent = "Error fetching count";
  }
});

async function downloadImages(basePrefix, baseSuffix, totalPages) {
  const images = [];
  const maxConcurrent = 3;

  for (let i = 1; i <= totalPages; i += maxConcurrent) {
    const batch = await Promise.allSettled(
      Array.from(
        { length: Math.min(maxConcurrent, totalPages - i + 1) },
        (_, j) =>
          downloadSingleImage(
            `${basePrefix}${(i + j).toString(16)}${baseSuffix}`,
            i + j,
            totalPages
          )
      )
    );

    images.push(
      ...batch
        .filter((r) => r.status === "fulfilled" && r.value)
        .map((r) => r.value)
    );
  }

  return images;
}

async function downloadSingleImage(imageUrl, pageNum, totalPages) {
  updateUI.progress(
    pageNum,
    totalPages,
    `Downloading page ${pageNum.toString(16)}`
  );

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    return new Promise((resolve, reject) => {
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(img.src);
        resolve({ canvas, pageNum });
      };

      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error(`Failed to load image`));
      };

      img.src = URL.createObjectURL(blob);
    });
  } catch (error) {
    console.warn(`Failed to download page ${pageNum.toString(16)}:`, error);
    return null;
  }
}

function createPDF(images, filename) {
  updateUI.status("Creating PDF...", "info");
  els.progress.text.textContent = "Creating PDF...";

  // Sort images by page number
  images.sort((a, b) => a.pageNum - b.pageNum);

  // Option 1: Try to use browser's built-in PDF creation
  if (window.SimplePDFGenerator) {
    const pdfGen = new SimplePDFGenerator();
    images.forEach((imageData) => {
      pdfGen.addPage(imageData.canvas);
    });
    pdfGen.generatePDF(filename);
    return { success: true, method: "HTML PDF" };
  }

  // Option 2: Download as individual images
  const imgDownloader = new ImageDownloader();
  images.forEach((imageData) => {
    imgDownloader.addImage(imageData.canvas, imageData.pageNum);
  });

  // Download all images
  imgDownloader.downloadAsImages(filename.replace(".pdf", ""));
  return { success: true, method: "Individual Images" };
}

els.downloadBtn.addEventListener("click", async () => {
  try {
    const response = await fetch(
      "https://studocu.hrmods.online/api/increment-pdf-count",
      {
        method: "POST",
      }
    );

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    if (data.count !== undefined) {
      updateUI.counter(data.count);
    } else {
      console.warn("Increment response did not contain count");
    }
  } catch (error) {
    console.error("Failed to increment PDF count:", error);
  }

  if (isDownloading) return;

  isDownloading = true;
  els.downloadBtn.disabled = true;
  els.downloadBtn.textContent = "Downloading...";
  els.progress.container.style.display = "block";

  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab.url.includes("studocu.com")) {
      throw new Error("Please navigate to a StudoCu document page");
    }

    updateUI.status("Analyzing page...", "info");

    // Send message to content script
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: "downloadPDF",
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    updateUI.status("Downloading images...", "info");

    const { totalPages, basePrefix, baseSuffix, filename } = response.data;

    // Download all images
    const images = await downloadImages(basePrefix, baseSuffix, totalPages);

    if (images.length === 0) {
      throw new Error("No images were downloaded successfully");
    }

    // Create and Get PDF
    const result = createPDF(images, filename);

    if (result.success) {
      updateUI.status(
        `Successfully processed ${images.length} pages!`,
        "success"
      );
      els.details.textContent = `Method: ${result.method}`;
    } else {
      throw new Error("Failed to create PDF");
    }
  } catch (error) {
    console.error("Download error:", error);
    updateUI.status(error.message, "error");
    els.details.textContent = "Check console for details";
  } finally {
    isDownloading = false;
    els.downloadBtn.disabled = false;
    els.downloadBtn.textContent = "Download as PDF";
    setTimeout(() => {
      els.progress.container.style.display = "none";
    }, 2000);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  console.log("Popup loaded and ready");
});
