# Retailer Payments Benchmark — Coverage / Traceability Map

Source of truth: Bianca's "Browserbase follow up.docx" (v1 and "(1)" are identical — no changes).
Purpose: guarantee every element of her ask is accounted for across the 10 phases.

## Axis 1 — Research Questions → Phases (1:1)
| RQ | Phase | Status |
|----|-------|--------|
| RQ1 Payment discovery (pre-checkout) | Phase 1 | DONE (needs mission-segmentation + scorecard reconcile — see below) |
| RQ2 Checkout experience & friction | Phase 2 | Pending — needs auth Contexts |
| RQ3 Payment-method capabilities | Phase 3 | Pending — needs auth + saved card |
| RQ4 Lowest out-of-pocket cost | Phase 4 | Pending — needs benefit instruments |
| RQ5 Eligibility & mixed baskets | Phase 5 | Pending — needs benefit instruments |
| RQ6 Split tender & benefit stacking | Phase 6 | Pending — needs multiple funded instruments |
| RQ7 Payment failure & recovery | Phase 7 | Pending — real orders; some declines not simulable on prod |
| RQ8 Post-transaction experience | Phase 8 | Pending — real completed orders |
| RQ9 Substitutions, OOS & refunds | Phase 9 | Pending — real fulfilled OD orders (calendar time) |
| RQ10 Marketplace payment rules | Phase 10 | Pending — auth (Amazon 1P/3P, Instacart cross-store) |

## Axis 2 — Shopping missions (every RQ × each mission)
EA = e-commerce · OD = online delivery · MB = mixed basket (eligible + ineligible)
| Retailer | EA | OD | Mixed basket |
|----------|----|----|--------------|
| Amazon | Yes | Yes (Amazon Fresh) | Yes (Fresh + FSA/HSA/SNAP items) |
| Instacart | n/a (delivery-native) | Yes (core) | Yes (eligible + non-eligible, split tender) |
| Costco | Yes (Costco.com) | Via Instacart (Same-Day) | Limited (benefits warehouse-only online) |
| Shopify (Allbirds) | Yes | No | No (DTC apparel, no benefit tenders) |
**Rule:** each phase must report findings per applicable mission and explicitly mark N/A where a mission doesn't exist for that retailer. (RQ1 report currently NOT segmented — retrofit needed.)

## Axis 3 — Deliverables (accumulate across phases)
| Deliverable | Produced / accumulated in |
|-------------|---------------------------|
| 1. Journey maps (per major tender × EA/OD/MB) | Built in Phase 2; enriched by Phase 5/8/9 |
| 2. Payment UX comparison matrix | Accumulates Phase 1,3,5,6,8,10 |
| 3. Annotated screenshots (search/PDP/cart/wallet/payment/checkout/error/confirmation/refund) | Every phase — curated browse-CLI capture pass |
| 4. Friction log (extra clicks, hidden options, confusing messaging, dead ends, failed recovery, eligibility confusion) | Every phase; heaviest RQ2,5,7,9 |
| 5. Best practices (benefit discovery, wallet design, checkout, messaging, recovery, refund) | Synthesized at end from all phases |
| 6. Payment UX scorecard (8 dims below) | Accumulates as phases complete |

## Master scorecard — Bianca's 8 dimensions → feeding RQs
(Use THESE 8 in the final scorecard; phase-level scorecards feed them.)
| Master dimension | Fed by |
|------------------|--------|
| Payment discovery | RQ1 |
| Benefit visibility | RQ1 + RQ4 |
| Checkout friction | RQ2 |
| Wallet experience | RQ3 |
| Split tender | RQ5 + RQ6 |
| Error recovery | RQ7 |
| Post-purchase experience | RQ8 + RQ9 |
| Refund/payment transparency | RQ9 + RQ8 |
Note: RQ10 (marketplace rules) feeds the comparison matrix, not a distinct scorecard row.

## RQ1 remediation to be "spec-complete"
- [ ] Segment RQ1 discovery findings by EA / OD / MB per retailer (mark N/A where applicable).
- [ ] Reconcile the RQ1 phase scorecard (6 discovery dims) to populate master rows "Payment discovery" + "Benefit visibility".
- [ ] Fill annotated-screenshot slots via curated browse-CLI pass.
