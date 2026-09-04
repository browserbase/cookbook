// Unified check: oracle (passed) + probe (measurements + instructionToFixer).
export default {
  expression: `(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    for (const select of [...document.querySelectorAll('select')]) {
      const option = [...select.options].find((item) => /24/.test(item.textContent || item.value));
      if (option) {
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    await sleep(1000);
    const text = document.body.innerText;
    const hasEmpty = /No metrics yet/i.test(text);
    const hasError = /Something went wrong|Failed to load|error/i.test(text);
    return {
      passed: hasEmpty && !hasError,
      hasEmpty,
      hasError,
      text: text.slice(0, 1500),
      passCondition: "selecting Last 24 hours renders the 'No metrics yet' empty state with no error text",
      instructionToFixer: "Distinguish empty data from a failed request: for an empty 24-hour result, render the 'No metrics yet' empty state and do not show error copy."
    };
  })()`
};
