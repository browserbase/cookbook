// Unified check: oracle (passed) + probe (measurements + instructionToFixer).
export default {
  expression: `(async () => {
    const details = [...document.querySelectorAll('[role="tab"], button')].find((el) => /^\\s*Details\\s*$/.test(el.textContent || ''));
    details?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    details?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    details?.click();
    details?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    const text = document.body.innerText;
    const hidden = !/Visa|4242|Next invoice|billing address/i.test(text);
    return {
      passed: hidden === true,
      hidden,
      text,
      passCondition: "while signed out, opening the Details tab reveals no protected billing content (no Visa/4242/Next invoice/billing address text)",
      instructionToFixer: "Guard the billing Details panel behind the auth state: while signed out, render a sign-in prompt or placeholder instead of card brand, last4, next invoice, or billing address details."
    };
  })()`
};
