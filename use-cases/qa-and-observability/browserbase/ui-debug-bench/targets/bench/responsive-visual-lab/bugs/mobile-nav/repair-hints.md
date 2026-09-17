# Repair hints

- The click handler is usually already working: the button changes to "Close menu" and the mobile links appear in the accessibility tree. The remaining failure is at the selector/visibility level, not in the toggle logic.
- The check matches `[data-btc-probe="mobile-menu"], nav` — if a hidden desktop `<nav>` appears earlier in the DOM than the opened mobile menu, generic visibility checks inspect the hidden desktop nav instead of the mobile menu.
- Do not leave `<nav data-btc-probe="desktop-nav">` before the opened mobile menu. Valid minimal fixes: change the desktop navigation wrapper from `<nav>` to `<div role="navigation" data-btc-probe="desktop-nav">`, or render `<nav data-btc-probe="mobile-menu">` before any other `<nav>` while the menu is open.
- Moving only the menu button is insufficient — the returned DOM must satisfy one of the conditions above.
