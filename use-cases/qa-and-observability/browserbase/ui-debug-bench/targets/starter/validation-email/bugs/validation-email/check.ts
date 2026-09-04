export default {
  expression: `(async () => {
    const setValue = (el, value) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const input = document.querySelector("input");
    const button = document.querySelector("button");
    const status = () => document.querySelector("[role=status]")?.textContent ?? "";
    if (input) setValue(input, "alex");
    button?.click();
    await new Promise((r) => setTimeout(r, 50));
    const invalidStatus = status();
    if (input) setValue(input, "alex@example.com");
    button?.click();
    await new Promise((r) => setTimeout(r, 50));
    const validStatus = status();
    const invalidRejected = /invalid|required|domain|email/i.test(invalidStatus) && invalidStatus !== "Invite sent";
    const validAccepted = validStatus === "Invite sent";
    return {
      passed: invalidRejected && validAccepted,
      invalidStatus,
      validStatus,
      invalidRejected,
      validAccepted,
      passCondition: "submitting 'alex' shows an invalid-email error (not 'Invite sent'), and submitting 'alex@example.com' shows 'Invite sent'",
      instructionToFixer: "Validate the email inside the submit handler: reject values without an @ and a domain, show a clear error, and only show 'Invite sent' for valid addresses."
    };
  })()`
};
