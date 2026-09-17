// Unified check: oracle (passed) + probe (measurements + instructionToFixer).
export default {
  viewport: { width: 375, height: 700 },
  expression: `(async () => {
    const wrap = document.querySelector('[data-btc-probe="invoice-list"], [data-btc-probe="invoice-card"]')?.parentElement || document.scrollingElement;
    const style = wrap ? getComputedStyle(wrap) : null;
    const scrollable = !!wrap && wrap.scrollWidth > wrap.clientWidth && style?.overflowX !== 'hidden';
    return {
      passed: scrollable === true,
      wrapTag: wrap?.tagName || "",
      dataProbe: wrap?.getAttribute?.("data-btc-probe") || "",
      scrollWidth: wrap?.scrollWidth || 0,
      clientWidth: wrap?.clientWidth || 0,
      overflowX: style?.overflowX || "",
      scrollable,
      passCondition: "the invoice wrapper has scrollWidth > clientWidth and overflowX is not hidden at 375px",
      instructionToFixer: "The check expects horizontal reachability, not stacked cards. Put invoice columns in an overflow-x-auto wrapper with a min-width child/table so scrollWidth exceeds clientWidth."
    };
  })()`
};
