const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

class ChunkStorage {
  constructor() {
    this.chunksDir = path.join(process.cwd(), "uploads", "chunks");
    this.ensureDirectoryExists(this.chunksDir);
  }

  ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  getChunkPath(sessionId, chunkNumber) {
    const sessionDir = path.join(this.chunksDir, sessionId);
    this.ensureDirectoryExists(sessionDir);
    return path.join(sessionDir, `chunk-${chunkNumber}`);
  }

  async saveChunk(sessionId, chunkNumber, chunkData) {
    const chunkPath = this.getChunkPath(sessionId, chunkNumber);
    await fs.promises.writeFile(chunkPath, chunkData);
    return chunkPath;
  }

  async readChunk(sessionId, chunkNumber) {
    const chunkPath = this.getChunkPath(sessionId, chunkNumber);
    return await fs.promises.readFile(chunkPath);
  }

  async chunkExists(sessionId, chunkNumber) {
    const chunkPath = this.getChunkPath(sessionId, chunkNumber);
    try {
      await fs.promises.access(chunkPath);
      return true;
    } catch {
      return false;
    }
  }

  async assembleFile(sessionId, totalChunks, outputPath) {
    const writeStream = fs.createWriteStream(outputPath);

    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = this.getChunkPath(sessionId, i);
      const chunkData = await fs.promises.readFile(chunkPath);
      writeStream.write(chunkData);
    }

    writeStream.end();

    return new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });
  }

  async cleanupSession(sessionId) {
    const sessionDir = path.join(this.chunksDir, sessionId);
    if (fs.existsSync(sessionDir)) {
      await fs.promises.rm(sessionDir, { recursive: true, force: true });
    }
  }

  async getSessionSize(sessionId) {
    const sessionDir = path.join(this.chunksDir, sessionId);
    if (!fs.existsSync(sessionDir)) return 0;

    const files = await fs.promises.readdir(sessionDir);
    let totalSize = 0;

    for (const file of files) {
      const filePath = path.join(sessionDir, file);
      const stats = await fs.promises.stat(filePath);
      totalSize += stats.size;
    }

    return totalSize;
  }

  generateSessionId() {
    return crypto.randomBytes(16).toString("hex");
  }
}

module.exports = new ChunkStorage();
