# Travel portal Flight Search Efficiency Task

## Goal
Open an already-authenticated Travel portal session, reach the one-way flight search results for SFO to JFK on 2026-06-15, and identify the fastest reliable route through the UI without selecting or buying a fare.

## Start URL
https://app.travel.example/app/user2/

## Inputs
- Origin: SFO
- Destination: JFK
- Depart date: 2026-06-15
- Trip type: One-way
- Preference: Nonstop only when the filter is available

## Constraints
- Use the saved Browserbase/Travel portal authenticated context when available.
- Do not enter credentials, bypass MFA, solve CAPTCHA, select a fare, reserve, hold, or purchase.
- If Travel portal asks for email verification, MFA, CAPTCHA, or another required human security step, stop and return that blocker.

## Expected Output
```json
{
  "status": "results|blocked|failed",
  "route": "SFO-JFK",
  "date": "2026-06-15",
  "cheapest_nonstop_price": 123,
  "airline": "Example Air",
  "flight_times": "6:00 AM - 2:30 PM",
  "blocker": null,
  "fast_path_notes": "Short description of the fastest reliable UI path discovered."
}
```
