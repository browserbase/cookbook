import type { OtpRequest } from "./otp-message.ts";

// HTML Templates - Using Browserbase Brand Colors
// Primary: #F03603 (orange-red), Black: #100D0D, Gray: #514F4F, Green: #90C94D, Blue: #4DA9E4
const styles = `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { font-family: 'Inter', system-ui, sans-serif; box-sizing: border-box; }
    body {
      background: linear-gradient(135deg, #100D0D 0%, #1a1616 50%, #201515 100%);
      min-height: 100vh;
      margin: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      position: relative;
    }
    body::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(ellipse at top right, rgba(240, 54, 3, 0.15) 0%, transparent 50%),
                  radial-gradient(ellipse at bottom left, rgba(77, 169, 228, 0.08) 0%, transparent 50%);
      pointer-events: none;
    }
    .demo-banner {
      background: #F03603;
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      margin-bottom: 30px;
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14px;
      font-weight: 500;
    }
    .demo-banner img { height: 20px; }
    .demo-banner .divider { opacity: 0.5; }
    .container {
      background: white;
      padding: 40px;
      border-radius: 8px;
      border: 1px solid #edebeb;
      max-width: 420px;
      width: 100%;
    }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { color: #100D0D; margin: 0; font-size: 22px; font-weight: 600; }
    .header p { color: #514F4F; margin-top: 8px; font-size: 14px; }
    .logo { font-size: 48px; margin-bottom: 16px; }
    .county-seal {
      width: 80px;
      height: 80px;
      background: #F03603;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      font-size: 36px;
    }
    input {
      width: 100%;
      padding: 12px 16px;
      margin: 8px 0;
      border: 1px solid #514F4F;
      border-radius: 4px;
      font-size: 14px;
      transition: border-color 0.2s;
    }
    input:focus {
      outline: none;
      border-color: #F03603;
    }
    button {
      width: 100%;
      padding: 12px;
      background: #F03603;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      margin-top: 16px;
      transition: background-color 0.2s;
    }
    button:hover {
      background: #100D0D;
    }
    .alert {
      padding: 14px 16px;
      background: #FEF3C7;
      border: 1px solid #F4BA41;
      border-radius: 4px;
      margin-bottom: 20px;
      text-align: center;
      font-size: 14px;
      color: #100D0D;
    }
    .success { background: #ECFCCB; border-color: #90C94D; color: #100D0D; }
    .doc-card {
      border: 1px solid #edebeb;
      padding: 20px;
      border-radius: 6px;
      margin: 20px 0;
      display: flex;
      align-items: center;
      gap: 16px;
      background: #F9F6F4;
    }
    .doc-icon { font-size: 44px; }
    .doc-info h3 { margin: 0; color: #100D0D; font-size: 16px; font-weight: 600; }
    .doc-info p { margin: 6px 0 0; color: #514F4F; font-size: 13px; }
    a.download {
      display: block;
      padding: 12px 24px;
      background: #90C94D;
      color: #100D0D;
      text-decoration: none;
      border-radius: 4px;
      text-align: center;
      font-weight: 500;
      transition: background-color 0.2s;
    }
    a.download:hover {
      background: #7AB83D;
    }
    .powered-by {
      margin-top: 30px;
      text-align: center;
      color: #514F4F;
      font-size: 12px;
    }
    .powered-by a { color: #F03603; text-decoration: none; font-weight: 600; }
  </style>
`;

const demoBanner = `
  <div class="demo-banner">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="white"/>
      <path d="M6 8h12M6 12h12M6 16h8" stroke="#F03603" stroke-width="2" stroke-linecap="round"/>
    </svg>
    <strong>Browserbase Demo</strong>
    <span class="divider">|</span>
    <span>the cookbook example Tax Document Automation</span>
  </div>
`;


function csrfField(csrf: string) { return `<input type="hidden" name="csrf" value="${csrf}" />`; }
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, character => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character]!)); }

export function loginPage(csrf: string) { return `
    <!DOCTYPE html>
    <html>
    <head><title>Maricopa County Tax Portal</title>${styles}</head>
    <body>
      ${demoBanner}
      <div class="container">
        <div class="header">
          <div class="county-seal">🏛️</div>
          <h1>Maricopa County</h1>
          <p>Property Tax Portal</p>
        </div>
        <p>Demo account only: demo_agent / demo123. This is not a real county login.</p>
        <form action="/login" method="POST">${csrfField(csrf)}
          <input type="text" name="username" placeholder="Username" required />
          <input type="password" name="password" placeholder="Password" required />
          <button type="submit">Sign In</button>
        </form>
      </div>
      <div class="powered-by">
        Powered by <a href="https://browserbase.com" target="_blank">Browserbase</a>
      </div>
    </body>
    </html>
  `; }

export function requestPage(csrf: string) { return `
    <!DOCTYPE html>
    <html>
    <head><title>Verify Identity</title>${styles}</head>
    <body>
      ${demoBanner}
      <div class="container">
        <div class="header">
          <div class="county-seal">🔐</div>
          <h1>Demo Email Verification</h1>
          <p>Verify your identity to continue</p>
        </div>
        <div class="alert">
          Access requires a code sent to the configured demo mailbox. No real user account is connected.
        </div>
        <form action="/send-otp" method="POST">${csrfField(csrf)}
          <button type="submit">Send OTP to Email</button>
        </form>
      </div>
      <div class="powered-by">
        Powered by <a href="https://browserbase.com" target="_blank">Browserbase</a>
      </div>
    </body>
    </html>
  `; }

export function verifyPage(csrf: string, recipient: string, request: OtpRequest) { return `
    <!DOCTYPE html>
    <html>
    <head><title>Enter OTP</title>${styles}</head>
    <body>
      ${demoBanner}
      <div class="container">
        <div class="header">
          <div class="county-seal">📧</div>
          <h1>Check Your Email</h1>
          <p>A code was accepted for delivery to ${escapeHtml(recipient)}</p>
          <p data-otp-request="${request.requestId}" data-otp-sender="${escapeHtml(request.sender)}" data-otp-subject="${escapeHtml(request.subject)}">Request ID: ${request.requestId}</p>
        </div>
        <form action="/verify-otp" method="POST">${csrfField(csrf)}
          <input type="text" name="otp" placeholder="000000" maxlength="6" pattern="[0-9]{6}" required style="text-align: center; font-size: 28px; letter-spacing: 12px; font-weight: 600;" />
          <button type="submit">Verify & Continue</button>
        </form>
      </div>
      <div class="powered-by">
        Powered by <a href="https://browserbase.com" target="_blank">Browserbase</a>
      </div>
    </body>
    </html>
  `; }

export function invalidPage(csrf: string) { return `
      <!DOCTYPE html>
      <html>
      <head><title>Invalid OTP</title>${styles}</head>
      <body>
        ${demoBanner}
        <div class="container">
          <div class="header">
            <div class="county-seal">⚠️</div>
            <h1>Invalid Code</h1>
            <p>Please check and try again</p>
          </div>
          <div class="alert" style="background: #fee2e2; border-color: #ef4444; color: #991b1b;">
            The verification code you entered is incorrect.
          </div>
          <form action="/verify-otp" method="POST">${csrfField(csrf)}
            <input type="text" name="otp" placeholder="000000" maxlength="6" required style="text-align: center; font-size: 28px; letter-spacing: 12px; font-weight: 600;" />
            <button type="submit">Try Again</button>
          </form>
        </div>
        <div class="powered-by">
          Powered by <a href="https://browserbase.com" target="_blank">Browserbase</a>
        </div>
      </body>
      </html>
    `; }

export function documentsPage() { return `
    <!DOCTYPE html>
    <html>
    <head><title>Tax Documents</title>${styles}</head>
    <body>
      ${demoBanner}
      <div class="container" style="max-width: 480px;">
        <div class="header">
          <div class="county-seal">📄</div>
          <h1>Your Tax Documents</h1>
          <p>Synthetic demonstration document</p>
        </div>
        <div class="alert success">✓ Identity verified successfully</div>

        <div class="doc-card">
          <div class="doc-icon">📑</div>
          <div class="doc-info">
            <h3>2024 Property Tax Statement</h3>
            <p>Demo parcel: DEMO-0001 | No payment required</p>
            <p style="color: #1a365d; font-weight: 600; margin-top: 8px;">Amount Due: $0.00 (synthetic)</p>
          </div>
        </div>
        <a href="/public/tax-statement-2024.pdf" download class="download">
          Download Tax Statement (PDF)
        </a>
      </div>
      <div class="powered-by">
        Powered by <a href="https://browserbase.com" target="_blank">Browserbase</a>
      </div>
    </body>
    </html>
  `; }
