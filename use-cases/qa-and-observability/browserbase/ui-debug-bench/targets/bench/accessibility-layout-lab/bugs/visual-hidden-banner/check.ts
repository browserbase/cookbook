// Unified check: oracle (passed) + probe (measurements + instructionToFixer).
export default {
  expression: `(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    document.querySelector('[data-btc-probe="onboarding-toast-dismiss"]')?.click();
    await sleep(3800);
    const header = document.querySelector('[data-btc-probe="sticky-header"], header')?.getBoundingClientRect();
    const banner = document.querySelector('[data-btc-probe="trial-banner"], [role="status"]')?.getBoundingClientRect();
    const separated = !!header && !!banner && banner.top >= header.bottom;
    return {
      passed: separated === true,
      separated,
      headerBottom: header?.bottom ?? -1,
      bannerTop: banner?.top ?? -1,
      passCondition: "after the onboarding toast is dismissed and the delayed trial banner appears, the banner's top edge sits at or below the sticky header's bottom edge",
      instructionToFixer: "Position the trial banner below the sticky header instead of underneath it: offset the banner by the header height (or give the page content top padding/stacking order) so the delayed banner is fully visible and never overlapped by the header."
    };
  })()`
};
