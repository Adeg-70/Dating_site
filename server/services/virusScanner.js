const clamd = require("clamdjs");
const fs = require("fs");
const path = require("path");

class VirusScanner {
  constructor() {
    this.scanner = null;
    this.isEnabled = process.env.ENABLE_VIRUS_SCAN === "true";
    this.initialize();
  }

  initialize() {
    if (this.isEnabled) {
      this.scanner = clamd.createScanner(
        process.env.CLAMAV_HOST || "localhost",
        parseInt(process.env.CLAMAV_PORT) || 3310
      );
    }
  }

  async scanBuffer(buffer) {
    if (!this.isEnabled) {
      return { isInfected: false, viruses: [] };
    }

    try {
      // Write buffer to temporary file
      const tempPath = path.join(
        "/tmp",
        `scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      );
      await fs.promises.writeFile(tempPath, buffer);

      const result = await this.scanFile(tempPath);

      // Clean up temp file
      await fs.promises.unlink(tempPath).catch(() => {});

      return result;
    } catch (error) {
      console.error("Virus scan error:", error);
      // Fail open - allow file if scan fails
      return { isInfected: false, viruses: [], error: error.message };
    }
  }

  async scanFile(filePath) {
    if (!this.isEnabled) {
      return { isInfected: false, viruses: [] };
    }

    try {
      const result = await this.scanner.scanFile(filePath);

      if (result.isInfected) {
        console.warn(
          `Virus detected: ${result.viruses.join(", ")} in file ${filePath}`
        );
      }

      return result;
    } catch (error) {
      console.error("Virus scan error:", error);
      return { isInfected: false, viruses: [], error: error.message };
    }
  }

  async scanDirectory(directoryPath) {
    if (!this.isEnabled) {
      return { scanned: 0, infected: 0, clean: 0 };
    }

    try {
      const files = await fs.promises.readdir(directoryPath);
      let scanned = 0;
      let infected = 0;
      let clean = 0;

      for (const file of files) {
        const filePath = path.join(directoryPath, file);
        const stats = await fs.promises.stat(filePath);

        if (stats.isFile()) {
          const result = await this.scanFile(filePath);
          scanned++;

          if (result.isInfected) {
            infected++;
            // Quarantine infected file
            await this.quarantineFile(filePath, result.viruses);
          } else {
            clean++;
          }
        }
      }

      return { scanned, infected, clean };
    } catch (error) {
      console.error("Directory scan error:", error);
      return { scanned: 0, infected: 0, clean: 0, error: error.message };
    }
  }

  async quarantineFile(filePath, viruses) {
    const quarantineDir = path.join(process.cwd(), "quarantine");
    await fs.promises.mkdir(quarantineDir, { recursive: true });

    const fileName = path.basename(filePath);
    const quarantinePath = path.join(
      quarantineDir,
      `${Date.now()}-${fileName}`
    );

    await fs.promises.rename(filePath, quarantinePath);

    // Log quarantine action
    console.log(`Quarantined file: ${filePath} -> ${quarantinePath}`);
    console.log(`Detected viruses: ${viruses.join(", ")}`);

    // TODO: Notify administrators
  }

  // Real-time scanning for uploads
  async scanUploadStream(stream, fileName) {
    return new Promise((resolve, reject) => {
      if (!this.isEnabled) {
        resolve({ isInfected: false, viruses: [] });
        return;
      }

      const chunks = [];
      let fileSize = 0;

      stream.on("data", (chunk) => {
        chunks.push(chunk);
        fileSize += chunk.length;

        // Implement size limit for scanning
        if (fileSize > 100 * 1024 * 1024) {
          // 100MB limit
          stream.destroy();
          resolve({
            isInfected: false,
            viruses: [],
            error: "File too large for scanning",
          });
        }
      });

      stream.on("end", async () => {
        try {
          const buffer = Buffer.concat(chunks);
          const result = await this.scanBuffer(buffer);
          resolve(result);
        } catch (error) {
          resolve({ isInfected: false, viruses: [], error: error.message });
        }
      });

      stream.on("error", reject);
    });
  }

  // Health check
  async healthCheck() {
    if (!this.isEnabled) {
      return { status: "disabled", version: null };
    }

    try {
      const version = await this.scanner.version();
      return { status: "healthy", version };
    } catch (error) {
      return { status: "unhealthy", error: error.message };
    }
  }
}

module.exports = new VirusScanner();
