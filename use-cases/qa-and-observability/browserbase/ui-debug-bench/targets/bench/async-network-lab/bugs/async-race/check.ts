// Unified check: oracle (passed) + probe (measurements + instructionToFixer).
export default {
  expression: `(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const input = document.querySelector('[data-btc-probe="search-input"], input');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (input) {
      setter?.call(input, 'alpha');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(80);
      setter?.call(input, 'beta');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await sleep(1000);
    const text = document.body.innerText.toLowerCase();
    const beta = text.includes('beta');
    const alpha = text.includes('alpha');
    return {
      passed: beta === true && alpha === false,
      text,
      beta,
      alpha,
      passCondition: "after typing alpha then beta, rendered results include beta and exclude stale alpha once async responses settle",
      instructionToFixer: "Guard async responses by latest query/request id or abort stale requests, so the slower alpha response cannot overwrite beta results."
    };
  })()`
};
