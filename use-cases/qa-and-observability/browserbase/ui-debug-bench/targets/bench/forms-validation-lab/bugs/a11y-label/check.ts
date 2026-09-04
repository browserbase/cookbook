// Unified check: oracle (passed) + probe (measurements + instructionToFixer).
export default {
  expression: `(async () => {
    const input = document.querySelector('[data-btc-probe="search"], [data-btc-probe="search-input"], input[type="search"], input');
    const id = input?.getAttribute('id');
    const labelled = Boolean(input?.getAttribute('aria-label') || input?.getAttribute('aria-labelledby') || input?.getAttribute('title') || (id && document.querySelector('label[for="' + id + '"]')) || input?.closest('label'));
    return {
      passed: labelled === true,
      labelled,
      passCondition: "the search input has an accessible name via aria-label, aria-labelledby, title, an associated label[for], or a wrapping label element",
      instructionToFixer: "Give the search input a programmatic accessible name: add aria-label (or associate a label element via for/id, or wrap it in a label). Placeholder text alone does not count as an accessible name."
    };
  })()`
};
