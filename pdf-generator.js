// Simple PDF generator without external dependencies
class SimplePDFGenerator {
  constructor() {
    this.pages = [];
  }

  addPage(canvas) {
    this.pages.push({
      imageData: canvas.toDataURL("image/jpeg", 0.8),
      width: canvas.width,
      height: canvas.height,
    });
  }

  generatePDF(filename) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { margin: 0; background: #1a202c; }
          .page { break-after: page; height: 100vh; display: grid; place-items: center; }
          img { max-width: 100%; max-height: 100%; object-fit: contain; }
        </style>
      </head>
      <body>
        ${this.pages
          .map((p) => `<div class="page"><img src="${p.imageData}"></div>`)
          .join("")}
      </body>
      </html>
    `;

    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const win = window.open(url, "_blank");
    win.onload = () => {
      setTimeout(() => {
        win.print();
        URL.revokeObjectURL(url);
      }, 1000);
    };
  }
}

// Alternative: Direct download as images in a ZIP-like structure
class ImageDownloader {
  constructor() {
    this.images = [];
  }

  addImage(canvas, pageNumber) {
    this.images.push({
      canvas,
      pageNumber,
      dataURL: canvas.toDataURL("image/png"),
    });
  }

  async downloadAsImages(filename) {
    // Download each image individually
    for (const img of this.images) {
      const link = document.createElement("a");
      link.href = img.dataURL;
      link.download = `${filename}_page_${img.pageNumber.toString(16)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Small delay between downloads
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

window.SimplePDFGenerator = SimplePDFGenerator;
window.ImageDownloader = ImageDownloader;
