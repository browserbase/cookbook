import { createElement } from "react";
import { storageTarget } from "./storage-target";
import { logger, task } from "@trigger.dev/sdk/v3";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { renderToBuffer } from "@react-pdf/renderer";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

export const generateResumePDF = task({
  id: "generate-resume-pdf",
  run: async (payload: { text: string }) => {
    const destination = storageTarget("resumes");
    logger.log("Generating PDF resume");

    const pdfBuffer = await renderToBuffer(
      createElement(Document, null,
        createElement(Page, { size: "A4" },
          createElement(View, null, createElement(Text, null, payload.text))))
    );

    const output = destination.file("resume.pdf");
    const uploadParams = {
      Bucket: destination.bucket,
      Key: output.key,
      Body: pdfBuffer,
      ContentType: "application/pdf",
    };

    logger.log("Uploading PDF to R2", { key: output.key });

    await s3Client.send(new PutObjectCommand(uploadParams));
    logger.log("PDF uploaded to R2", { key: output.key });
    return { pdfUrl: output.url, key: output.key, bucket: destination.bucket };
  },
});
