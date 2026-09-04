// Unified check: oracle (passed) + probe (measurements + instructionToFixer).
export default {
  expression: `(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1400));
    const text = document.body.innerText;
    const rowCount = document.querySelectorAll('[data-btc-probe="project-row"], li, tr').length;
    const hasRows = rowCount > 0;
    const loadingGone = !/loading|syncing/i.test(text);
    return {
      passed: hasRows === true && loadingGone === true,
      text,
      rowCount,
      hasRows,
      loadingGone,
      passCondition: "project rows are present and no loading/syncing text remains after data resolves",
      instructionToFixer: "If rows exist but loadingGone is false, clear every loading/syncing indicator once the data has resolved. Avoid leaving a persistent badge/spinner with loading/syncing text."
    };
  })()`
};
