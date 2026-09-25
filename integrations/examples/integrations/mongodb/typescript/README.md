# Stagehand MongoDB Scraper

A web scraping project that uses Stagehand to extract structured data from e-commerce websites and store it in MongoDB for analysis.

## Features

- **Web Scraping**: Uses Stagehand (built on Playwright) for intelligent web scraping
- **Data Extraction**: Extracts structured product data using AI-powered instructions
- **MongoDB Storage**: Stores scraped data in MongoDB for persistence and querying
- **Schema Validation**: Uses Zod for schema validation and TypeScript interfaces
- **Error Handling**: Failed extraction, database operations, index setup, or cleanup produce a nonzero exit status
- **Data Analysis**: Built-in MongoDB queries for data analysis

## Prerequisites

- Node.js 22.18 or higher
- MongoDB installed locally or MongoDB Atlas account
- Browserbase API key

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd stagehand-mongodb-scraper
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   ```
   # Create a .env file with the following variables
   BROWSERBASE_API_KEY=your_browserbase_api_key
   MONGO_URI=mongodb://localhost:27017
   DB_NAME=scraper_db
   ```

## Usage

1. Start MongoDB locally:
   ```
   mongod
   ```

2. Run the scraper:
   ```
   npm start
   ```

3. The script will:
   - Scrape product listings from Amazon
   - Extract detailed information for the first 3 products
   - Store all data in MongoDB
   - Run analysis queries on the collected data showing:
     - Collection counts
     - Products by category
     - Top-rated products

## Project Structure

The project has a simple structure with a single file containing all functionality:

- `index.ts`: Contains the complete implementation including:
  - MongoDB connection and data operations
  - Schema definitions
  - Scraping functions
  - Data analysis
  - Main execution logic
- `.env.example`: Example environment variables

## Data Models

The project uses the following data models:

- **Product**: Individual product information
- **ProductList**: List of products from a category page
- **Review**: Product reviews

## MongoDB Collections

Data is stored in the following MongoDB collections:

- **products**: Individual product information
- **product_lists**: Lists of products from category pages
- **reviews**: Product reviews

## License

MIT

## Acknowledgements

- [Stagehand](https://docs.stagehand.dev/) for the powerful web scraping capabilities
- [MongoDB](https://www.mongodb.com/) for the flexible document database
- [Zod](https://zod.dev/) for runtime schema validation

## Browser installation

This example connects to a Browserbase remote browser. Its dependency installation does not run `playwright install`, and the workflow does not need locally downloaded browser binaries.

## Storage and failure behavior

Products use their absolute HTTP(S) URL as the unique storage key. Each listing product receives the extracted list category before both snapshot and product storage, so category grouping can use the stored field. Listing and detail writes use `updateOne` with `$set` and `upsert`, so enriching an existing product updates its record. Omitted or undefined fields retain prior values; `_id` is excluded from updates. Listing snapshots remain append-only. This is not a transaction across snapshots and products: a failed run can leave partial writes that a later run can update.

Product URLs are validated across each batch before writing. The connection is cached only after connection and index setup succeed. Index conflicts fail setup instead of allowing storage without the requested unique constraint. Analysis uses the database returned by that connection. A listing, requested detail, query, or cleanup failure prevents the final success message. The runner independently attempts MongoDB, Stagehand, and browser cleanup and exits nonzero on failure.

## Local verification

Run `node --test tests/storage.test.mjs` after installing this package's dependencies. The tests execute the source functions with real Zod and an in-memory collection that enforces unique product URLs. They cover enrichment, omitted fields, invalid batches, connection/index failures, analysis, cleanup, and CLI failure status. Isolated typechecking passed with MongoDB 7.6.0 and Stagehand 4.0.2. No live MongoDB server, Amazon page, or model workflow was exercised.
