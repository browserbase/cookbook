# Airline portal Flight Booking Automation Demo

A comprehensive Browserbase automation demo that searches and extracts flight information from Airline portal.com using Stagehand's AI-driven automation capabilities.

## What This Demo Does

This automation demo demonstrates:

1. **Intelligent Form Filling**: Uses natural language commands to fill complex flight booking forms
2. **Dynamic Content Handling**: Manages autocomplete dropdowns, date pickers, and dynamic content
3. **Structured Data Extraction**: Extracts flight information into a validated JSON schema
4. **Error Handling & Resilience**: Includes retry logic, validation, and comprehensive error management
5. **Production-Ready Architecture**: Clean logging, type safety, and enterprise-grade code structure

### Business Value

- **Travel Industry Automation**: Demonstrates how to automate complex travel booking flows
- **Data Intelligence**: Extract competitive flight pricing and availability data
- **Customer Experience**: Automate booking processes for customer service applications
- **Market Research**: Gather flight data for business intelligence and pricing strategies

## Demo Flow

1. **Navigation**: Opens Airline portal.com and handles cookie consent
2. **Form Automation**: Fills booking form using natural language:
   - Trip type selection (One-way/Return)
   - Origin/destination airports with autocomplete
   - Date selection using date pickers
   - Passenger count configuration
3. **Search Execution**: Initiates flight search
4. **Data Extraction**: Extracts comprehensive flight data including:
   - Flight numbers, times, and durations
   - Pricing information and fare types
   - Aircraft details and availability
   - Booking classes and seat availability
5. **Schema Validation**: Validates extracted data against predefined schema
6. **Results Output**: Provides formatted results with summary and insights

## Setup Instructions

### Prerequisites

- Node.js 18+ installed
- Browserbase account with API access
- TypeScript knowledge (optional for usage)

### Installation

1. **Clone and navigate to demo folder**:
   ```bash
   cd travel-and-hospitality/sample-03/flight-booking
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env` file with your credentials**:
   ```env
   # Required Browserbase credentials
   BROWSERBASE_API_KEY=your_api_key_here
   BROWSERBASE_PROJECT_ID=your_project_id_here

   # Demo configuration (optional - defaults provided)
   ORIGIN_AIRPORT=BUD          # Budapest
   DESTINATION_AIRPORT=LTN     # London Luton
   DEPARTURE_DATE=2025-09-15   # Future date
   RETURN_DATE=2025-09-22      # Return date (for return trips)
   PASSENGERS=1                # Number of passengers (1-9)
   TRIP_TYPE=return           # 'oneway' or 'return'

   # Debug options
   DEBUG=false                 # Enable detailed logging
   HEADLESS=true              # Run in headless mode
   ```

### Getting Browserbase Credentials

1. Sign up at [browserbase.com](https://browserbase.com)
2. Create a new project in your dashboard
3. Copy your API key and Project ID to the `.env` file

## Usage

### Test Connection
```bash
npm run test
```

### Run Demo
```bash
npm start
```

### Development Mode (with file watching)
```bash
npm run dev
```

## What's Happening During Automation

The demo performs these automated steps:

### 1. Page Initialization
- Navigates to Airline portal.com using Browserbase cloud browser
- Handles cookie consent popups automatically
- Waits for page to fully load and become interactive

### 2. Form Automation
- **Trip Type**: Selects one-way or return trip based on configuration
- **Airports**: Uses AI to interact with autocomplete fields:
  - Types airport codes (e.g., "BUD" for Budapest)
  - Selects correct airports from dropdown suggestions
- **Dates**: Navigates date picker components:
  - Selects departure date from calendar
  - Selects return date for round trips
- **Passengers**: Adjusts passenger count using increment/decrement controls

### 3. Search Execution
- Clicks "Start booking" button to initiate search
- Waits for search results to load
- Handles loading states and potential errors

### 4. Data Extraction
Uses Stagehand's AI extraction to gather:
- **Flight Details**: Numbers, times, airports, duration
- **Pricing**: Amounts, currency, fare types (WIZZ Basic, Priority, etc.)
- **Aircraft**: Plane model information
- **Availability**: Seat availability and booking classes

### 5. Data Processing
- Validates extracted data against TypeScript schema
- Formats dates and times consistently
- Calculates search duration metrics
- Provides error handling for malformed data

## Expected Output Schema

```json
{
  "searchCriteria": {
    "origin": "BUD",
    "destination": "LTN",
    "departureDate": "2025-09-15",
    "returnDate": "2025-09-22",
    "passengers": 1,
    "tripType": "return"
  },
  "outboundFlights": [
    {
      "flightNumber": "W6 2345",
      "departureTime": "14:30",
      "arrivalTime": "16:45",
      "departureAirport": "BUD",
      "arrivalAirport": "LTN",
      "duration": "2h 15m",
      "aircraft": "Airbus A320",
      "price": {
        "amount": 89.99,
        "currency": "EUR",
        "fareType": "WIZZ Basic"
      },
      "availability": {
        "seatsAvailable": true,
        "bookingClass": "Economy"
      }
    }
  ],
  "returnFlights": [...],
  "searchTimestamp": "2025-01-20T10:30:00.000Z",
  "totalResults": 4,
  "searchDuration": "12.34s"
}
```

## Configuration Options

### Supported Routes

Airline portal primarily operates European routes. Recommended configurations:

```env
# Popular Airline portal Routes
ORIGIN_AIRPORT=BUD
DESTINATION_AIRPORT=LTN    # Budapest → London Luton

ORIGIN_AIRPORT=WAW
DESTINATION_AIRPORT=BCN    # Warsaw → Barcelona

ORIGIN_AIRPORT=VIE
DESTINATION_AIRPORT=ROM    # Vienna → Rome

ORIGIN_AIRPORT=PRG
DESTINATION_AIRPORT=ATH    # Prague → Athens
```

### Airport Codes Supported
- **BUD**: Budapest Ferenc Liszt International
- **LTN**: London Luton
- **BCN**: Barcelona El Prat
- **ROM**: Rome Fiumicino
- **PRG**: Prague Václav Havel
- **VIE**: Vienna International
- **WAW**: Warsaw Chopin
- **ATH**: Athens International

### Date Format
- Use YYYY-MM-DD format (e.g., "2025-09-15")
- Departure date must be in the future
- Return date must be after departure date

## Troubleshooting

### Common Issues

1. **"No flights found"**
   - Check if route is operated by Airline portal
   - Verify dates are in the future
   - Try different airport combinations

2. **"Timeout errors"**
   - Website may be slow - increase wait times
   - Check internet connection
   - Verify Browserbase credentials

3. **"Extraction errors"**
   - Page structure may have changed
   - Check if search actually completed
   - Enable DEBUG=true for detailed logs

4. **"Cookie consent issues"**
   - Some regions have different cookie popups
   - Demo handles most common cases automatically

### Debug Mode

Enable detailed logging:
```env
DEBUG=true
HEADLESS=false  # See browser in action
```

### Test Specific Routes

Modify `.env` file for different routes:
```bash
# Test different route
ORIGIN_AIRPORT=WAW
DESTINATION_AIRPORT=BCN
DEPARTURE_DATE=2025-10-01
```

## File Structure

```
airline_portal-flight-booking-demo/
├── src/
│   ├── main.ts              # Main automation script
│   ├── types.ts             # TypeScript types and Zod schemas
│   ├── utils.ts             # Helper functions and utilities
│   └── test-connection.ts   # Connection testing script
├── package.json             # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── .env.example            # Environment variables template
└── README.md               # This comprehensive guide
```

## Next Steps

This demo can be extended for:

1. **Multi-Airline Comparison**: Add support for other airline websites
2. **Price Monitoring**: Set up scheduled runs to track price changes
3. **Booking Completion**: Extend to complete actual bookings
4. **Advanced Filtering**: Add filters for price ranges, times, stops
5. **API Integration**: Create REST API endpoints for the automation

---

*This demo showcases Browserbase's enterprise browser automation capabilities for the travel industry. The code is production-ready and can be adapted for various flight booking and travel automation use cases.*