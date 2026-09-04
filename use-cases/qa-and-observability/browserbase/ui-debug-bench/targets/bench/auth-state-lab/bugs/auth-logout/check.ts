// Unified check: oracle (passed) + probe (measurements + instructionToFixer).
export default {
  expression: `(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    document.querySelector('[data-btc-probe="user-menu"], button')?.click();
    await sleep(120);
    const logout = [...document.querySelectorAll('[data-btc-probe="logout-button"], button, [role="menuitem"]')].find((el) => /logout|log out|sign out/i.test(el.textContent || ''));
    logout?.click();
    await sleep(200);
    const text = document.body.innerText;
    const signedOut = /signed out|sign in/i.test(text);
    const protectedGone = !document.querySelector('[data-btc-probe="protected-sidebar"]');
    return {
      passed: signedOut === true && protectedGone === true,
      text,
      signedOut,
      protectedGone,
      passCondition: "after clicking Logout, signed-out text appears and the protected sidebar is absent from the DOM",
      instructionToFixer: "Wire the actual logout menu item event to clear signed-in state and hide protected UI. If using a menu library, use the correct event for item selection/click."
    };
  })()`
};
