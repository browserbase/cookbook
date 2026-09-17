// Unified check: oracle (passed) + probe (measurements + instructionToFixer).
export default {
  viewport: { width: 375, height: 700 },
  expression: `(async () => {
    const cards = [...document.querySelectorAll('[data-btc-probe="plan-card"], article, section')];
    const pro = cards.find((el) => /^\\s*Pro\\b/i.test(el.textContent || '') || /Upgrade to Pro/i.test(el.textContent || ''));
    const toggles = [...(pro?.querySelectorAll('[data-btc-probe="plan-details-toggle"], button') || [])];
    const toggle = toggles.find((el) => /details|show|expand/i.test(el.textContent || ''));
    toggle?.scrollIntoView({ block: 'center' });
    toggle?.click();
    await new Promise((resolve) => setTimeout(resolve, 500));
    const ctaEl = pro?.querySelector('[data-btc-probe="pro-cta"]') || [...(pro?.querySelectorAll('a, button') || [])].find((el) => /start|upgrade|get|pro/i.test(el.textContent || ''));
    const cta = ctaEl?.getBoundingClientRect();
    const card = pro?.getBoundingClientRect();
    const root = document.scrollingElement || document.documentElement;
    const contained = !!cta && !!card && cta.left >= card.left && cta.right <= card.right;
    const noOverflow = root.scrollWidth <= root.clientWidth + 1;
    return {
      passed: contained === true && noOverflow === true,
      contained,
      noOverflow,
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      passCondition: "after expanding the Pro plan details at 375px, the Pro CTA stays within the card's left/right edges and the page has no horizontal overflow",
      instructionToFixer: "Constrain the expanded Pro card content at mobile width: let the CTA/price row wrap or shrink inside the card (e.g. min-width 0, flex-wrap, full-width CTA) so nothing extends past the card edges or widens the document beyond the viewport."
    };
  })()`
};
