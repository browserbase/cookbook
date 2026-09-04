// Unified check: oracle (passed) + probe (measurements + instructionToFixer).
export default {
  expression: `(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const isDark = () => document.documentElement.classList.contains('dark') || document.body.classList.contains('dark') || /dark/i.test(document.body.className);
    document.querySelector('[data-btc-probe="theme-toggle"], button')?.click();
    await sleep(150);
    const before = isDark();
    document.querySelector('[data-btc-probe="settings-trigger"], button')?.click();
    await sleep(200);
    const after = isDark();
    return {
      passed: before === true && after === true,
      before,
      after,
      htmlClass: document.documentElement.className,
      bodyClass: document.body.className,
      passCondition: "after clicking the theme toggle, dark mode is detectable both before and after opening Settings",
      instructionToFixer: "The theme toggle must apply a detectable dark class to html/body/app root, and opening Settings must not reset that state."
    };
  })()`
};
