import { Resend } from "resend";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { createTaxPortal } from "./portal.ts";
import { acceptedEmailDelivery } from "./email-delivery.ts";
import { serverConfiguration } from "./server-config.ts";

dotenv.config();
const config = serverConfiguration(process.env);
const resend = process.env.RESEND_API_KEY?.trim() ? new Resend(process.env.RESEND_API_KEY) : undefined;
const deliverCode = acceptedEmailDelivery(
  message => {
    if (!resend) throw new Error("Email delivery is not configured.");
    return resend.emails.send(message);
  },
  process.env.FROM_EMAIL?.trim() || "onboarding@resend.dev",
);
const app = createTaxPortal({
  origin: config.origin,
  recipient: process.env.USER_EMAIL,
  deliverCode,
  statementPath: fileURLToPath(new URL("./public/tax-statement-2024.pdf", import.meta.url)),
});
app.listen(config.port, config.host, () => {
  console.log(`Mock tax portal listening on ${config.host}:${config.port}; open ${config.origin}`);
});
