// Unified check: oracle (passed) + probe (measurements + instructionToFixer).
export default {
  expression: `(async () => {
    const value = () => Number((document.querySelector('[data-btc-probe="quantity-value"], output')?.textContent || '').match(/\\d+/)?.[0] || 0);
    const before = value();
    document.querySelector('[data-btc-probe="quantity-increment"], button[aria-label*="plus" i], button[aria-label*="increase" i]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const after = value();
    return {
      passed: typeof before === "number" && after === before + 1,
      before,
      after,
      passCondition: "clicking the plus/increment button raises the displayed quantity by exactly one",
      instructionToFixer: "Wire the plus button to increment the quantity (and subtotal) by 1 instead of decrementing it: fix the increment handler so it adds rather than subtracts."
    };
  })()`
};
