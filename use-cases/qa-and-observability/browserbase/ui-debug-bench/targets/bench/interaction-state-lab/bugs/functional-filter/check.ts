// Unified check: oracle (passed) + probe (measurements + instructionToFixer).
export default {
  expression: `(async () => {
    const completed = [...document.querySelectorAll('button, [role="tab"]')].find((el) => /completed/i.test(el.textContent || ''));
    completed?.click();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const items = [...document.querySelectorAll('[data-btc-probe="task-item"], li, article')].map((el) => el.textContent || '').join('\\n');
    const onlyCompleted = /done|completed|shipped|paid/i.test(items) && !/active|schedule|todo|open/i.test(items);
    return {
      passed: onlyCompleted === true,
      items,
      onlyCompleted,
      passCondition: "after clicking the Completed filter, listed task text contains completed/done status wording and no active/schedule/todo/open wording",
      instructionToFixer: "Fix the Completed filter so it shows only completed tasks, and make each completed row's text expose an explicit completed/done status word while the Completed view contains no active/schedule/todo/open wording."
    };
  })()`
};
