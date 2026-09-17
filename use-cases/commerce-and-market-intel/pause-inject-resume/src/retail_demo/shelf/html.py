"""The synthetic Retailer shelf the demo drives.

Three pieces of page state are exposed as CSS-selectable attributes so the agent
can wait on them with ``page.wait_for_selector`` -- Stagehand v4 has no
wait-for-expression method.

    body[data-search-applied="true"]           search submitted
    body[data-external-data-injected="true"]   Retailer signals injected
    #cart-status[data-added="true"]            item added to cart
"""

from __future__ import annotations

import urllib.parse


def shelf_data_url() -> str:
    """The shelf as a self-contained data: URL.

    A local HTTP server would be unreachable from a Browserbase cloud browser,
    and this keeps the package dependency-free. The v4 extension attaches to
    data: URLs fine -- verified on both local Chrome and Browserbase.
    """
    return "data:text/html;charset=utf-8," + urllib.parse.quote(retailer_shelf_html())


def product_card(
    product_id: str,
    name: str,
    price: float,
    category: str,
    inventory: int,
    badge: str,
) -> str:
    # The SKU is rendered as visible text, not just a data- attribute. Stagehand's
    # extract() reads the accessibility tree, which does not expose arbitrary
    # data- attributes -- without this line the model invents ids and everything
    # downstream that keys on product id silently breaks. Real shelves show item
    # numbers too, so this is not a demo-only concession.
    return f"""
    <article data-product-id="{product_id}" data-price="{price}" data-category="{category}" data-inventory="{inventory}" data-badge="{badge}">
      <div class="badge">{badge}</div>
      <div data-name>{name}</div>
      <div class="sku">SKU {product_id}</div>
      <div class="price">${price:.2f}</div>
      <div class="badge">{inventory} available - {category}</div>
      <div data-score></div>
      <div data-reason></div>
      <button data-action="add-to-cart">Add to cart</button>
    </article>
  """


def retailer_shelf_html() -> str:
    cards = "".join([
        product_card("wmt-backpack", "Mainstays Dorm Starter Set", 44.97, "school", 88, "Rollback"),
        product_card("wmt-breakfast", "Great Value Family Breakfast Bundle", 18.48, "grocery", 120, "Best value"),
        product_card("wmt-diapers", "Parent's Choice Diapers Mega Pack", 24.97, "household", 64, "Subscribe eligible"),
        product_card("wmt-headphones", "onn. Wireless Headphones", 29.88, "electronics", 32, "Low price"),
        product_card("wmt-printer", "HP DeskJet Home Printer", 69.00, "electronics", 18, "Popular"),
    ])

    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Retailer POC - Stagehand v4 Pause and Inject Demo</title>
    <style>
      :root {{
        color-scheme: light;
        --blue: #0071dc;
        --ink: #1f2937;
        --muted: #667085;
        --line: #d7dde8;
        --yellow: #ffc220;
        --green: #2e7d32;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }}

      body {{
        margin: 0;
        background: #f4f7fb;
        color: var(--ink);
      }}

      header {{
        align-items: center;
        background: var(--blue);
        color: white;
        display: flex;
        gap: 24px;
        padding: 18px 36px;
      }}

      header strong {{
        color: var(--yellow);
        font-size: 22px;
      }}

      main {{
        margin: 0 auto;
        max-width: 1180px;
        padding: 28px 24px 48px;
      }}

      .toolbar {{
        align-items: center;
        display: grid;
        gap: 12px;
        grid-template-columns: 1fr auto;
        margin-bottom: 18px;
      }}

      input {{
        border: 1px solid var(--line);
        border-radius: 6px;
        font-size: 16px;
        padding: 12px 14px;
      }}

      button {{
        background: var(--blue);
        border: 0;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        font-weight: 700;
        padding: 12px 16px;
      }}

      #external-signals {{
        align-items: center;
        background: #fff8d8;
        border: 1px solid #f0d46d;
        border-radius: 8px;
        display: flex;
        gap: 18px;
        min-height: 46px;
        padding: 12px 14px;
      }}

      #shelf {{
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        margin-top: 18px;
      }}

      article {{
        background: white;
        border: 1px solid var(--line);
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-height: 270px;
        padding: 16px;
      }}

      article.recommended {{
        border-color: var(--green);
        box-shadow: 0 0 0 3px rgba(46, 125, 50, 0.18);
      }}

      [data-name] {{
        font-size: 17px;
        font-weight: 750;
        line-height: 1.2;
      }}

      .price {{
        font-size: 26px;
        font-weight: 800;
      }}

      .badge {{
        color: var(--muted);
        font-size: 13px;
      }}

      .sku {{
        color: var(--muted);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px;
      }}

      [data-score] {{
        color: var(--green);
        font-weight: 800;
        min-height: 20px;
      }}

      [data-reason] {{
        color: var(--muted);
        flex: 1;
        font-size: 13px;
        line-height: 1.35;
        min-height: 52px;
      }}

      #cart-status {{
        background: white;
        border: 1px solid var(--line);
        border-radius: 8px;
        font-weight: 800;
        margin-top: 18px;
        padding: 14px 16px;
      }}
    </style>
  </head>
  <body>
    <header>
      <strong>Retailer POC</strong>
      <span>Stagehand v4 harness demo: browse, pause, inject internal signals, resume</span>
    </header>
    <main>
      <div class="toolbar">
        <input id="search-input" aria-label="Search" placeholder="Search Retailer" />
        <button id="apply-search">Search</button>
      </div>
      <section id="external-signals" aria-live="polite">No internal API signals injected yet.</section>
      <section id="shelf">{cards}</section>
      <section id="cart-status">Cart is empty.</section>
    </main>
    <script>
      document.querySelector("#apply-search").addEventListener("click", () => {{
        document.body.dataset.searchApplied = "true";
        document.querySelector("#cart-status").textContent =
          "Search applied. Harness can pause here and call internal Retailer APIs.";
      }});
      for (const button of document.querySelectorAll("[data-action='add-to-cart']")) {{
        button.addEventListener("click", () => {{
          const card = button.closest("[data-product-id]");
          const productId = card.getAttribute("data-product-id");
          const name = card.querySelector("[data-name]").textContent.trim();
          const cartStatus = document.querySelector("#cart-status");
          document.body.dataset.selectedProductId = productId;
          cartStatus.textContent = "Added " + name + " to cart.";
          cartStatus.dataset.added = "true";
        }});
      }}
    </script>
  </body>
</html>"""
