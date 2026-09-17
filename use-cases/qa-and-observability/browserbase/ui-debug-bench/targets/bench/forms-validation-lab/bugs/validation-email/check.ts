// Unified check: oracle (passed) + probe (measurements + instructionToFixer).
export default {
  expression: `(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const email = document.querySelector('[data-btc-probe="email"], input[type="email"], input');
    if (email) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(email, 'alex');
      email.dispatchEvent(new Event('input', { bubbles: true }));
      email.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const role = document.querySelector('[data-btc-probe="role"], select');
    if (role && role.options?.length > 1) {
      role.value = role.options[1].value;
      role.dispatchEvent(new Event('change', { bubbles: true }));
    }
    document.querySelector('[data-btc-probe="send-now"], input[type="checkbox"], button[role="switch"]')?.click();
    await sleep(100);
    const submit = document.querySelector('[data-btc-probe="submit"], button[type="submit"], button');
    submit?.click();
    await sleep(150);
    const text = document.body.innerText;
    const accepted = /Invite sent|sent/i.test(text);
    const rejected = /invalid|valid email|domain|@/i.test(text);
    return {
      passed: rejected === true && accepted === false,
      emailValue: email?.value || "",
      submitDisabled: !!submit?.disabled || submit?.getAttribute?.("aria-disabled") === "true",
      text,
      accepted,
      rejected,
      passCondition: "the invalid email 'alex' is rejected and 'Invite sent' never appears, even after the role/send-now path",
      instructionToFixer: "Make invalid email rejection happen inside submit handling as well as disabled-state handling. The app must show a clear invalid-email error and must not show sent/success for 'alex'."
    };
  })()`
};
