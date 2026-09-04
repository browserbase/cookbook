// Unified check: oracle (passed) + probe (measurements + instructionToFixer).
export default {
  viewport: { width: 375, height: 700 },
  expression: `(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const describe = (el) => {
      if (!el) return null;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        dataProbe: el.getAttribute("data-btc-probe") || "",
        ariaLabel: el.getAttribute("aria-label") || "",
        className: typeof el.className === "string" ? el.className : "",
        text: (el.textContent || "").replace(/\\s+/g, " ").trim(),
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        linkCount: el.querySelectorAll("a").length
      };
    };
    const toggle = document.querySelector('[data-btc-probe="nav-toggle"], button');
    toggle?.click();
    await sleep(250);
    const selector = '[data-btc-probe="mobile-menu"], nav';
    const matched = document.querySelector(selector);
    const candidates = [...document.querySelectorAll(selector)].map((el, index) => ({ index, ...describe(el) }));
    const style = matched ? getComputedStyle(matched) : null;
    const visible = !!style && style.display !== 'none' && style.visibility !== 'hidden';
    const linkCount = matched?.querySelectorAll('a').length || 0;
    return {
      passed: visible === true && linkCount > 0,
      viewport: { width: innerWidth, height: innerHeight },
      selector,
      querySelectorMatched: describe(matched),
      candidates,
      visible,
      linkCount,
      passCondition: "after tapping the nav toggle at 375px, the first match for [data-btc-probe='mobile-menu'], nav is visible (display/visibility) and contains at least one link",
      instructionToFixer: "If querySelectorMatched is a hidden desktop nav, change source so the first match after opening the menu is the visible mobile menu with links. Hard requirement: do not leave <nav data-btc-probe='desktop-nav'> before the mobile menu. Either change desktop nav to <div role='navigation'> or render <nav data-btc-probe='mobile-menu'> before any other nav."
    };
  })()`
};
