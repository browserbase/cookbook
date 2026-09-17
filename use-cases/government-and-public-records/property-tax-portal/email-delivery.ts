import { otpSubject, senderAddress } from "./otp-message.ts";

type Message = { from: string; to: string; subject: string; html: string };

export function acceptedEmailDelivery(
  send: (message: Message) => Promise<unknown>,
  from: string,
) {
  const sender = senderAddress(from);
  return async ({ recipient, code, requestId }: { recipient: string; code: string; requestId: string }) => {
    const subject = otpSubject(requestId);
    if (!/^\d{6}$/.test(code)) throw new Error("Invalid verification code.");
    const result = await send({
      from, to: recipient, subject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 0;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">
              Maricopa County Treasurer
            </h1>
            <p style="color: #a0c4ff; margin: 5px 0 0; font-size: 14px;">Property Tax Services</p>
          </div>

          <!-- Body -->
          <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e2e8f0; border-top: none;">
            <p style="color: #2d3748; font-size: 16px; margin: 0 0 20px;">
              You requested a verification code to access your tax records. Enter this code to continue:
            </p>

            <!-- OTP Box -->
            <div style="background: #f7fafc; border: 2px solid #1a365d; border-radius: 8px; padding: 25px; text-align: center; margin: 25px 0;">
              <p style="font-size: 14px; margin: 0 0 12px;">Verification code:</p>
              <span style="font-size: 36px; font-weight: 700; letter-spacing: 12px; color: #1a365d; font-family: 'Courier New', monospace;">
                ${code}
              </span>
            </div>

            <p style="color: #718096; font-size: 14px; margin: 20px 0 0;">
              This code is valid for up to <strong>10 minutes</strong> and expires sooner if your portal session ends. If you did not request this code, please ignore this email.
            </p>
          </div>

          <p>Request ID: ${requestId}</p>

          <!-- Footer -->
          <div style="background: #f7fafc; padding: 20px 30px; border: 1px solid #e2e8f0; border-top: none; text-align: center;">
            <p style="color: #a0aec0; font-size: 12px; margin: 0;">
              Maricopa County Treasurer's Office<br>
              301 W Jefferson St, Phoenix, AZ 85003<br>
              treasurer.maricopa.gov
            </p>
          </div>
        </div>`,
    });
    if (!result || typeof result !== "object" || !("data" in result) ||
        ("error" in result && result.error) || !result.data || typeof result.data !== "object" ||
        !("id" in result.data) || typeof result.data.id !== "string" || !result.data.id.trim()) {
      throw new Error("Email provider did not accept the message.");
    }
    return { sender, subject };
  };
}
