export default {
  expression: `(async () => {
    await new Promise((r) => setTimeout(r, 400));
    const text = document.body.innerText;
    const hasEmptyState = /No metrics yet/.test(text);
    const hasErrorOverlay = Boolean(document.querySelector("#vite-error-overlay") || document.querySelector("vite-error-overlay"));
    return {
      passed: hasEmptyState && !hasErrorOverlay,
      hasEmptyState,
      hasErrorOverlay,
      visibleText: text.slice(0, 1500),
      passCondition: "an empty metrics response renders the 'No metrics yet' empty state with no runtime error overlay",
      instructionToFixer: "Guard the dashboard rendering against an empty metrics array: detect empty data and render a 'No metrics yet' empty state instead of crashing or showing an error."
    };
  })()`
};
