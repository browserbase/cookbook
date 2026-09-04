// Unified check: oracle (passed) + probe (measurements + instructionToFixer).
export default {
  expression: `(async () => {
    document.querySelector('[data-btc-probe="retry-button"], button')?.click();
    await new Promise((resolve) => setTimeout(resolve, 1400));
    const text = document.body.innerText;
    const report = /Q1 revenue|revenue|report/i.test(text);
    const error = /Network error|Failed|error/i.test(text);
    return {
      passed: report === true && error === false,
      text,
      report,
      error,
      passCondition: "after clicking Retry, report data appears and all error text is gone",
      instructionToFixer: "Retry must clear the error state and transition to successful report data. Do not leave stale Network error/Failed/error text in the DOM after success."
    };
  })()`
};
