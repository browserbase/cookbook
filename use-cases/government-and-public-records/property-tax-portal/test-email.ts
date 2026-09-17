import { Resend } from "resend";
import dotenv from "dotenv";
dotenv.config();


async function test() {
  try {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const recipient = process.env.USER_EMAIL?.trim();
    if (!apiKey || !recipient) throw new Error("Email configuration is incomplete.");
    const resend = new Resend(apiKey);
    console.log("Requesting a synthetic test email; recipient and credentials omitted.");
    const result = await resend.emails.send({
      from: process.env.FROM_EMAIL || "onboarding@resend.dev",
      to: recipient,
      subject: "Test OTP Email from Maricopa County",
      html: "<h1>Test OTP: 123456</h1><p>If you see this, email is working!</p>",
    });

    if (result.error || !result.data || typeof result.data.id !== "string" || !result.data.id.trim()) {
      throw new Error("Email provider did not accept the message.");
    }
    console.log("Test email accepted by the provider; inbox delivery is unverified.");
  } catch (error) {
    console.error("Test email failed; sensitive error details omitted.");
    process.exitCode = 1;
  }
}

test();
