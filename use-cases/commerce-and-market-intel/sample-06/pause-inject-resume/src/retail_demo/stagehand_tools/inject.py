"""The JavaScript that renders Retailer's signals into the live page.

Stagehand v4's Python ``page.evaluate`` takes a JavaScript *expression string*
(the TypeScript SDK also accepts a function plus argument), so the payload is
serialized into the expression.
"""

from __future__ import annotations

import json
from typing import Any

_INJECT_FN = """
function injectSignals(input) {
  var cartBefore = document.querySelector("#cart-status");
  var receipt = {
    token: input.verification_token,
    search_applied: document.body.dataset.searchApplied === "true",
    selected_before: document.body.dataset.selectedProductId || null,
    cart_added_before: cartBefore ? cartBefore.dataset.added === "true" : null,
    action: null
  };
  if (window.__retailerCartObserver) document.removeEventListener("click", window.__retailerCartObserver);
  window.__retailerVerification = receipt;
  window.__retailerCartObserver = function (event) {
    var button = event.target.closest && event.target.closest("[data-action='add-to-cart']");
    if (!button) return;
    var card = button.closest("[data-product-id]");
    var cart = document.querySelector("#cart-status");
    receipt.action = {
      token: receipt.token,
      product_id: card ? card.getAttribute("data-product-id") : null,
      injected: document.body.dataset.externalDataInjected === "true",
      cart_added: cart ? cart.dataset.added === "true" : false,
      selected_product_id: document.body.dataset.selectedProductId || null
    };
  };
  document.addEventListener("click", window.__retailerCartObserver);
  document.body.dataset.externalDataInjected = "true";
  var recommended = input.recommended_product_id;
  var signalsByProduct = new Map(input.signals.map(function (signal) {
    return [signal.product_id, signal];
  }));

  var panel = document.querySelector("#external-signals");
  if (panel) {
    panel.innerHTML =
      "<strong>" + input.segment + "</strong>" +
      "<span>Budget ceiling: $" + input.budget_ceiling + "</span>" +
      "<span>Recommended SKU: " + recommended + "</span>";
  }

  var cards = Array.prototype.slice.call(document.querySelectorAll("[data-product-id]"));
  cards.forEach(function (card) {
    var productId = card.getAttribute("data-product-id");
    var signal = productId == null ? null : signalsByProduct.get(productId);
    card.classList.toggle("recommended", productId === recommended);
    card.setAttribute("data-affinity-score", String(signal ? signal.affinity_score : 0));
    var score = card.querySelector("[data-score]");
    if (score) score.textContent = signal ? signal.affinity_score + "% fit" : "";
    var reason = card.querySelector("[data-reason]");
    if (reason) reason.textContent = signal ? signal.reason : "";
  });

  var shelf = document.querySelector("#shelf");
  cards.sort(function (left, right) {
    return Number(right.getAttribute("data-affinity-score")) -
           Number(left.getAttribute("data-affinity-score"));
  });
  cards.forEach(function (card) { if (shelf) shelf.appendChild(card); });

  return { injected: true, recommended_product_id: recommended, cards: cards.length, ...receipt };
}
"""

FINAL_STATE_EXPRESSION = """
(function () {
  var panel = document.querySelector("#external-signals");
  var cart = document.querySelector("#cart-status");
  var top = document.querySelector("[data-product-id]");
  return {
    cart_status: cart ? cart.textContent.trim() : null,
    cart_added: cart ? cart.dataset.added === "true" : false,
    verification: window.__retailerVerification || null,
    injected: document.body.dataset.externalDataInjected === "true",
    selected_product_id: document.body.dataset.selectedProductId || null,
    top_shelf_product_id: top ? top.getAttribute("data-product-id") : null,
    visible_signal_panel: panel ? panel.textContent.replace(/\\s+/g, " ").trim() : null
  };
})()
"""


def expression_with_json_arg(fn_source: str, arg: Any) -> str:
    payload = json.dumps(arg, default=str).replace("<", "\\u003c")
    return f"({fn_source})({payload})"


def inject_signals_expression(signal_response: Any, token: str) -> str:
    return expression_with_json_arg(_INJECT_FN, {**signal_response, "verification_token": token})
