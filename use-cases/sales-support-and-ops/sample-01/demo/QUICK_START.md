# Quick Start Guide

## Prerequisites
- Browserbase account with API key
- AI model API key (Anthropic Claude, OpenAI, or Google Gemini)
- Node.js 18+ installed

## Setup (5 minutes)

### 1. Configure Environment
```bash
cd use-cases/sales-support-and-ops/sample-01/demo
cp .env.example .env
nano .env  # or use your preferred editor
```

Add your API keys to `.env`:
```bash
BROWSERBASE_API_KEY=bb_live_xxxxxxxxxxxxx
BROWSERBASE_PROJECT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MODEL_API_KEY=sk-ant-xxxxxxxxxxxxx  # or OpenAI/Gemini key
```

### 2. Deploy Functions
```bash
npm run deploy:all
```

This will deploy both functions:
- `find-reservations` - Search for restaurants
- `book-reservation` - Complete bookings

## Usage

### Find Reservations

```bash
curl -X POST https://api.browserbase.com/v1/functions/find-reservations/invoke \
  -H "Content-Type: application/json" \
  -H "x-bb-api-key: $BROWSERBASE_API_KEY" \
  -d '{
    "location": "San Francisco, CA",
    "date": "2026-02-20",
    "time": "19:00",
    "partySize": 2,
    "cuisineOrType": "Italian",
    "apiKey": "'"$MODEL_API_KEY"'"
  }'
```

**Response includes**:
- List of available restaurants
- Time slots with booking URLs
- AI-generated summary
- Session replay URL

### Book Reservation

```bash
curl -X POST https://api.browserbase.com/v1/functions/book-reservation/invoke \
  -H "Content-Type: application/json" \
  -H "x-bb-api-key: $BROWSERBASE_API_KEY" \
  -d '{
    "bookingUrl": "https://www.opentable.com/r/restaurant?...",
    "date": "2026-02-20",
    "time": "19:00",
    "partySize": 2,
    "guestFirstName": "John",
    "guestLastName": "Doe",
    "guestEmail": "john@example.com",
    "guestPhoneNumber": "415-555-0123",
    "apiKey": "'"$MODEL_API_KEY"'"
  }'
```

**Response includes**:
- Confirmation number
- Restaurant details
- Reservation details
- Cancellation policy
- Session replay URL

## Typical Workflow

1. **Search** for restaurants using `find-reservations`
2. **Extract** a `bookingUrl` from the results
3. **Book** using `book-reservation` with that URL
4. **Review** session replay if needed

## Important Notes

⚠️ **Test bookings create real reservations** - Always cancel test reservations immediately

✅ **Session replay URLs** - Included in all responses for debugging

🔒 **Guest checkout** - No OpenTable account needed

⏱️ **Execution time** - 30-90 seconds typical

## Troubleshooting

### "No restaurants found"
- Verify location format (e.g., "San Francisco, CA")
- Try broader search (remove cuisine filter)
- Check session replay URL

### "Booking failed"
- Time slot may be unavailable (check `availableAlternatives`)
- Some restaurants require credit card
- Review session replay URL

### "Function timeout"
- Reduce `maxSteps` parameter
- Try simpler search criteria

## Files

- **README.md** - Complete documentation
- **IMPLEMENTATION_SUMMARY.md** - Technical details
- **find-reservations.ts** - Search function source
- **book-reservation.ts** - Booking function source

## Support

For detailed documentation, see `README.md`

For implementation details, see `IMPLEMENTATION_SUMMARY.md`
