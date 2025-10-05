const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

class EncryptionService {
  constructor() {
    this.algorithm = "aes-256-gcm";
    this.keyDerivation = {
      iterations: 100000,
      keylen: 32,
      digest: "sha512",
    };
  }

  generateKey() {
    return crypto.randomBytes(32); // 256 bits
  }

  generateIV() {
    return crypto.randomBytes(16); // 128 bits for AES
  }

  async deriveKey(password, salt) {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        password,
        salt,
        this.keyDerivation.iterations,
        this.keyDerivation.keylen,
        this.keyDerivation.digest,
        (err, derivedKey) => {
          if (err) reject(err);
          else resolve(derivedKey);
        }
      );
    });
  }

  async encryptFile(inputPath, outputPath, key) {
    return new Promise((resolve, reject) => {
      const iv = this.generateIV();
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      const authTagLength = 16;

      const input = fs.createReadStream(inputPath);
      const output = fs.createWriteStream(outputPath);

      // Write IV and auth tag space first
      output.write(iv);

      input.pipe(cipher).pipe(output);

      output.on("finish", () => {
        // Write authentication tag at the end
        const authTag = cipher.getAuthTag();
        output.write(authTag);
        resolve({
          iv: iv.toString("hex"),
          authTag: authTag.toString("hex"),
        });
      });

      output.on("error", reject);
    });
  }

  async decryptFile(inputPath, outputPath, key) {
    return new Promise((resolve, reject) => {
      const input = fs.createReadStream(inputPath);
      const output = fs.createWriteStream(outputPath);

      // Read IV from beginning
      let iv = null;
      let fileData = Buffer.alloc(0);

      input.on("data", (chunk) => {
        fileData = Buffer.concat([fileData, chunk]);
      });

      input.on("end", () => {
        try {
          // Extract IV (first 16 bytes) and auth tag (last 16 bytes)
          iv = fileData.subarray(0, 16);
          const authTag = fileData.subarray(-16);
          const encryptedData = fileData.subarray(16, -16);

          const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
          decipher.setAuthTag(authTag);

          const decrypted = Buffer.concat([
            decipher.update(encryptedData),
            decipher.final(),
          ]);

          output.write(decrypted);
          output.end();
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      input.on("error", reject);
      output.on("error", reject);
    });
  }

  async encryptBuffer(buffer, key) {
    const iv = this.generateIV();
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);

    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);

    const authTag = cipher.getAuthTag();

    return {
      iv: iv,
      encryptedData: encrypted,
      authTag: authTag,
      fullData: Buffer.concat([iv, encrypted, authTag]),
    };
  }

  async decryptBuffer(encryptedBuffer, key) {
    const iv = encryptedBuffer.subarray(0, 16);
    const authTag = encryptedBuffer.subarray(-16);
    const encryptedData = encryptedBuffer.subarray(16, -16);

    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  }

  // For end-to-end encryption between users
  async generateUserKeyPair() {
    return new Promise((resolve, reject) => {
      crypto.generateKeyPair(
        "rsa",
        {
          modulusLength: 4096,
          publicKeyEncoding: {
            type: "spki",
            format: "pem",
          },
          privateKeyEncoding: {
            type: "pkcs8",
            format: "pem",
          },
        },
        (err, publicKey, privateKey) => {
          if (err) reject(err);
          else resolve({ publicKey, privateKey });
        }
      );
    });
  }

  async encryptWithPublicKey(data, publicKey) {
    const encrypted = crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      data
    );

    return encrypted;
  }

  async decryptWithPrivateKey(encryptedData, privateKey) {
    const decrypted = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      encryptedData
    );

    return decrypted;
  }

  // Secure key exchange protocol
  async createSecureUploadSession(senderPublicKey, receiverPublicKey) {
    const sessionKey = this.generateKey();

    // Encrypt session key with both users' public keys
    const senderEncryptedKey = await this.encryptWithPublicKey(
      sessionKey,
      senderPublicKey
    );
    const receiverEncryptedKey = await this.encryptWithPublicKey(
      sessionKey,
      receiverPublicKey
    );

    return {
      sessionKey: sessionKey.toString("hex"),
      senderEncryptedKey: senderEncryptedKey.toString("base64"),
      receiverEncryptedKey: receiverEncryptedKey.toString("base64"),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    };
  }
}

module.exports = new EncryptionService();
