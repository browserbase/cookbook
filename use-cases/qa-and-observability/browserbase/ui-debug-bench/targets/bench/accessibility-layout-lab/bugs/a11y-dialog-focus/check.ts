// Unified check: oracle (passed) + probe (measurements + instructionToFixer).
export default {
  expression: `(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const describe = (el) => ({
      tag: el?.tagName || "",
      dataProbe: el?.getAttribute?.("data-btc-probe") || "",
      role: el?.getAttribute?.("role") || "",
      text: (el?.textContent || "").replace(/\\s+/g, " ").trim(),
      ariaLabel: el?.getAttribute?.("aria-label") || ""
    });
    document.querySelector('[data-btc-probe="row-action-details"], [data-btc-probe="row-menu"], button')?.click();
    await sleep(120);
    document.querySelector('[data-btc-probe="details-delete"], [data-btc-probe="delete-file"], button[data-variant="destructive"]')?.click();
    await sleep(150);
    const dialog = document.querySelector('[data-btc-probe="confirm-dialog"], [role="dialog"]');
    const active = document.activeElement;
    const inside = !!dialog && dialog.contains(active);
    return {
      passed: !!dialog && inside === true,
      dialog: describe(dialog),
      active: describe(active),
      inside,
      passCondition: "the confirmation dialog exists and document.activeElement is contained inside it after the delete confirmation opens",
      instructionToFixer: "If inside is false, focus a real button/input inside the dialog when it opens. Use autoFocus or a ref/effect on the dialog content, not the trigger behind the modal."
    };
  })()`
};
