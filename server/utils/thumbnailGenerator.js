const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

// Install sharp first: npm install sharp

async function generateThumbnail(filePath, filename) {
  try {
    const thumbnailsDir = path.join(path.dirname(filePath), "thumbnails");
    if (!fs.existsSync(thumbnailsDir)) {
      fs.mkdirSync(thumbnailsDir, { recursive: true });
    }

    const thumbnailPath = path.join(thumbnailsDir, `thumb-${filename}`);

    await sharp(filePath)
      .resize(200, 200, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath);

    return thumbnailPath;
  } catch (error) {
    console.error("Thumbnail generation error:", error);
    return null;
  }
}

module.exports = { generateThumbnail };
