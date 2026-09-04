"""
ZIP / store_id -> Browserbase proxy geolocation lookup.

Strategy:
  1. Hardcoded `ZIP_CITIES` map: the ZIPs in your CSV, mapped to reliable
     nearby metros (verified to have available proxy IPs).
  2. For unknown ZIPs: fall back to country="US" only (proxy still routes
     through a US IP, just without city precision — fine for anti-bot,
     since the actual store selection happens via the ceremony, not the
     IP geo).

NOTE on city accuracy: BB proxies support fine city granularity, but
smaller towns sometimes fail at runtime with ERR_TUNNEL_CONNECTION_FAILED
if no proxy IP is currently available. Defaulting to the nearest major
metro is the safe choice — it gives Akamai the right regional IP, while
the store-locator ceremony picks the exact store via ZIP search.

City values are case-insensitive (BB normalizes to lowercase + underscored),
so casing doesn't matter — we use lowercase by convention.

To extend ZIP_CITIES with a new metro: try the lowercase+underscored city
name (e.g. "san_francisco", "kansas_city"); if you hit a tunnel failure,
fall back to the largest nearby metro or country-only.
"""

# Customer CSV ZIPs -> (city, state).
#
# We use the nearest major metro for each ZIP, NOT the literal ZIP city.
# Small towns can fail at runtime even when the validator accepts them.
# Major metros are the reliable choice — they give the right regional IP,
# and the ceremony picks the exact store via ZIP search anyway.
#
# To extend: look up a new ZIP's metro and add it here. Use the lowercase +
# underscored form (e.g. "san_francisco"). If a smaller city hits
# ERR_TUNNEL_CONNECTION_FAILED, fall back to the largest nearby metro.
ZIP_CITIES = {
    "02108": ("boston", "MA"),         # Beacon Hill, Boston
    "07088": ("newark", "NJ"),         # Vauxhall is in Newark metro
    "10001": ("new_york", "NY"),       # Chelsea / Midtown, NYC
    "19103": ("philadelphia", "PA"),   # Rittenhouse Sq, Philly
    "30301": ("atlanta", "GA"),
    "33101": ("miami", "FL"),
    "60601": ("chicago", "IL"),        # The Loop
    "75201": ("dallas", "TX"),         # Downtown Dallas
    "77566": ("houston", "TX"),        # Lake Jackson is ~50mi south of Houston
    "80202": ("denver", "CO"),
    "90210": ("los_angeles", "CA"),    # Beverly Hills is in LA metro
    "98101": ("seattle", "WA"),
}


def proxy_geo_for_zip(zip_code: str) -> dict:
    """Return the Browserbase proxy geolocation dict for a given ZIP.

    For known ZIPs, returns the city+state+country.
    For unknown ZIPs, returns country='US' only (graceful fallback).
    """
    if zip_code in ZIP_CITIES:
        city, state = ZIP_CITIES[zip_code]
        return {"country": "US", "state": state, "city": city}
    # Unknown ZIP — use US-only proxy. Works fine; the ceremony picks the store.
    return {"country": "US"}


# -----------------------------------------------------------------------------
# store_id -> ZIP mapping.
#
# Neither HD nor TSC's public site/API lets us localize directly by store
# number — the store-locator search box matches "0915" as a fuzzy ZIP query,
# not a store-number lookup, and direct /storeId/<id> URLs return 404/403.
#
# So for `store_id` and `store_id_4digit_hint` rows in the CSV, we look up the
# store's ZIP here and dispatch to the regular ZIP-based ceremony.
#
# This map needs to be filled in by the customer (they own the store_id
# values in the CSV — they know which physical store each represents).
# Format key: "<domain>:<store_id>", value: ZIP string.
#
# Example entries (REPLACE with the customer's actual store ZIPs):
#   "homedepot:0915": "33064",   # if HD 0915 = Pompano Beach, FL
#   "homedepot:6003": "<zip>",
#   "tractorsupply:0915": "<zip>",
# -----------------------------------------------------------------------------
STOREID_TO_ZIP: dict[str, str] = {
    # Verified during PoC: HD store #0915 is at 2445 Springfield Ave,
    # Vauxhall NJ 07088 (note: this is the same physical store the CSV's
    # 07088 ZIP rows point to — store_id and zip notations overlap here).
    "homedepot:0915": "07088",

    # TODO (Sample Organization): fill these in from your internal store data.
    # "homedepot:6003": "<zip>",
    # "tractorsupply:0915": "<zip>",
}


def zip_for_store_id(domain: str, store_id: str) -> str | None:
    return STOREID_TO_ZIP.get(f"{domain}:{store_id}")
