import { storageTarget } from "./storage-target";
import { logger, task } from "@trigger.dev/sdk/v3";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import fs from "fs";
import path from "path";

// Initialize S3 client
const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

export const pdfToImage = task({
  id: "pdf-to-image",
  run: async (payload: { pdfUrl: string; documentId: string }) => {
    if (!payload || typeof payload.documentId !== "string" ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(payload.documentId)) {
      throw new Error("documentId must contain 1–128 letters, digits, underscores or hyphens");
    }
    if (typeof payload.pdfUrl !== "string") {
      throw new Error("pdfUrl must be an HTTP(S) URL");
    }
    const url = new URL(payload.pdfUrl);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      throw new Error("pdfUrl must be an HTTP(S) URL without credentials");
    }

    const destination = storageTarget(`images/${payload.documentId}`);
    const workDir = fs.mkdtempSync(path.join(tmpdir(), "pdf-to-image-"));
    try {
      const pdfPath = path.join(workDir, "document.pdf");
      const outputDir = path.join(workDir, "pages");
      fs.mkdirSync(outputDir);
      execFileSync("curl", [
        "--fail", "--silent", "--show-error", "--max-time", "60",
        "--proto", "=http,https", "--output", pdfPath, "--", url.href,
      ]);
      execFileSync("mutool", ["convert", "-o", path.join(outputDir, "page-%d.png"), pdfPath]);

      // Upload images to R2
      const uploadedUrls = [];
      for (const file of fs.readdirSync(outputDir)) {
        const output = destination.file(file);
        const uploadParams = {
          Bucket: destination.bucket,
          Key: output.key,
          Body: fs.readFileSync(path.join(outputDir, file)),
          ContentType: "image/png",
        };

        logger.log("Uploading image to R2", { key: output.key });

        await s3Client.send(new PutObjectCommand(uploadParams));
        uploadedUrls.push(output.url);
        logger.log("Image uploaded to R2", { key: output.key });
      }

      logger.log("All images uploaded to R2", { urls: uploadedUrls });

      return {
        imageUrls: uploadedUrls,
      };
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  },
});
