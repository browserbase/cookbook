import { withBrowser } from "./with-browser";
import { storageTarget } from "./storage-target";
import { logger, task } from "@trigger.dev/sdk/v3";
import puppeteer from "puppeteer";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Initialize S3 client
const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

export const puppeteerWebpageToPDF = task({
  id: "puppeteer-webpage-to-pdf",
  run: async () => {
    const destination = storageTarget("pdfs");
    const browser = await puppeteer.launch();
    const generatePdf = await withBrowser(browser, async browser => {
      const page = await browser.newPage();
      const response = await page.goto("https://google.com");
      const url = response?.url() ?? "No URL found";

      // Generate PDF from the webpage
      const pdf = await page.pdf();

      logger.info("PDF generated from URL", { url });
      return pdf;
    });

    // Upload to R2
    const output = destination.file("page.pdf");
    const uploadParams = {
      Bucket: destination.bucket,
      Key: output.key,
      Body: generatePdf,
      ContentType: "application/pdf",
    };

    logger.log("Uploading PDF to R2", { key: output.key });

    // Upload the PDF to R2 and return the URL.
    await s3Client.send(new PutObjectCommand(uploadParams));
    logger.log("PDF uploaded to R2", { key: output.key });
    return { pdfUrl: output.url, key: output.key, bucket: destination.bucket };
  },
});
