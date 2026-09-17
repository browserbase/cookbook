// Unified check: oracle (passed) + probe (measurements + instructionToFixer).
export default {
  expression: `(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const notes = [...document.querySelectorAll('button, [role="tab"]')].find((el) => /notes/i.test(el.textContent || ''));
    const activity = [...document.querySelectorAll('button, [role="tab"]')].find((el) => /activity/i.test(el.textContent || ''));
    notes?.click();
    await sleep(120);
    const textarea = document.querySelector('[data-btc-probe="note-textarea"], textarea');
    if (textarea) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(textarea, 'Keep this draft');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await sleep(120);
    activity?.click();
    await sleep(120);
    notes?.click();
    await sleep(120);
    const value = document.querySelector('[data-btc-probe="note-textarea"], textarea')?.value || '';
    return {
      passed: value === 'Keep this draft',
      value,
      passCondition: "the textarea value remains 'Keep this draft' after switching Notes -> Activity -> Notes",
      instructionToFixer: "Store draft note state outside the tab panel that unmounts. Do not reset note state on tab change or remount."
    };
  })()`
};
