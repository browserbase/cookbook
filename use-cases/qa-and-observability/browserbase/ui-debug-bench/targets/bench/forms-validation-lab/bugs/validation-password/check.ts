// Unified check: oracle (passed) + probe (measurements + instructionToFixer).
export default {
  expression: `(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const setValue = (el, value) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
    };
    const inputs = [...document.querySelectorAll('input')];
    for (const input of inputs) {
      if (input.type === 'password' || /password|confirm/i.test(input.getAttribute('data-btc-probe') || input.placeholder || '')) {
        setValue(input, 'abc');
      }
    }
    const submit = [...document.querySelectorAll('[data-btc-probe="submit"], button[type="submit"], button')].find((el) => /update|reset|submit/i.test(el.textContent || '')) || document.querySelector('button');
    submit?.click();
    await sleep(250);
    const text = document.body.innerText;
    const accepted = /updated|success/i.test(text);
    const rejected = /too short|minimum|must be at least|password.*8/i.test(text);
    return {
      passed: rejected === true && accepted === false,
      text,
      accepted,
      rejected,
      passCondition: "submitting the 3-character password 'abc' shows a too short/minimum-length error and never shows updated/success copy",
      instructionToFixer: "Enforce the minimum password length (at least 8 characters) in the submit handler: reject short passwords with a clear 'too short'/'must be at least 8 characters' error and do not show updated/success messaging."
    };
  })()`
};
