import os
import asyncio
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from product_urls import normalize_product_url
from pydantic import BaseModel
from pymongo import MongoClient, IndexModel, ASCENDING, DESCENDING
from pymongo.errors import DuplicateKeyError
from stagehand import Stagehand, Page, browserbase
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize rich console for better output
console = Console()

# ========== MongoDB Configuration ==========
MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'scraper_db')

# ========== Pydantic Models (Schema Definitions) ==========
class Product(BaseModel):
    """Product model for e-commerce websites"""
    url: Optional[str] = None
    source_url: str
    observation_index: int
    date_scraped: datetime
    name: str
    price: str
    rating: Optional[float] = None
    category: Optional[str] = None
    id: Optional[str] = None
    currency: Optional[str] = None
    image_url: Optional[str] = None
    review_count: Optional[int] = None
    description: Optional[str] = None
    specs: Optional[Dict[str, Any]] = None

class ProductList(BaseModel):
    """Product list model for results from category pages"""
    products: List[Product]
    category: Optional[str] = None
    date_scraped: datetime
    total_products: Optional[int] = None
    page: Optional[int] = None
    website_name: Optional[str] = None

# Schema for extraction (without date_scraped since that's added later)
class ProductExtraction(BaseModel):
    """Schema for extracting product data from pages"""
    name: str
    price: str
    url: Optional[str] = None
    rating: Optional[float] = None
    reviewCount: Optional[int] = None
    description: Optional[str] = None
    specs: Optional[Dict[str, Any]] = None

class ProductListExtraction(BaseModel):
    """Schema for extracting product list data from category pages"""
    products: List[ProductExtraction]
    category: str
    totalProducts: Optional[int] = None


# ========== MongoDB Connection and Operations ==========
class MongoDBManager:
    """Handles MongoDB connections and operations"""
    
    def __init__(self, uri: str, db_name: str):
        self.uri = uri
        self.db_name = db_name
        self.client = None
        self.db = None
        
        # Collection names
        self.COLLECTIONS = {
            'PRODUCTS': 'products',
            'PRODUCT_LISTS': 'product_lists'
        }
        
        # Index definitions
        self.INDEXES = {
            self.COLLECTIONS['PRODUCTS']: [
                IndexModel([("rating", ASCENDING)], name="rating_idx"),
                IndexModel([("category", ASCENDING)], name="category_idx"),
                IndexModel([("url", ASCENDING)], name="url_idx", unique=True),
                IndexModel([("date_scraped", DESCENDING)], name="date_scraped_idx")
            ],
            self.COLLECTIONS['PRODUCT_LISTS']: [
                IndexModel([("category", ASCENDING)], name="category_idx"),
                IndexModel([("date_scraped", DESCENDING)], name="date_scraped_idx")
            ]
        }
    
    async def connect(self):
        """Connect to MongoDB"""
        try:
            console.print("🔌 Connecting to MongoDB...", style="blue")
            self.client = MongoClient(self.uri)
            
            # Test connection
            self.client.admin.command('ismaster')
            self.db = self.client[self.db_name]
            
            console.print("✅ Connected to MongoDB", style="green")
            
            # Create indexes
            await self._create_indexes()
            
        except Exception as e:
            console.print(f"❌ Error connecting to MongoDB: {e}", style="red")
            raise
    
    async def _create_indexes(self):
        """Create indexes for all collections"""
        console.print("⚙️ Creating indexes...", style="blue")
        
        for collection_name, indexes in self.INDEXES.items():
            try:
                collection = self.db[collection_name]
                
                # Create indexes
                for index in indexes:
                    try:
                        collection.create_index(
                            index.document['key'],
                            name=index.document.get('name'),
                            unique=index.document.get('unique', False),
                            background=True
                        )
                        console.print(f"✅ Created index {index.document.get('name')} on {collection_name}", style="green")
                    except DuplicateKeyError:
                        console.print(f"⚠️ Index {index.document.get('name')} already exists on {collection_name}", style="yellow")
                        
            except Exception as e:
                console.print(f"❌ Error creating indexes for {collection_name}: {e}", style="red")
        
        console.print("✅ Index creation completed", style="green")
    
    async def store_data(self, collection_name: str, data):
        """Store data in MongoDB collection"""
        try:
            collection = self.db[collection_name]

            if collection_name == self.COLLECTIONS['PRODUCTS']:
                items = data if isinstance(data, list) else [data]
                stored = 0
                for item in items:
                    document = item.model_dump() if hasattr(item, 'model_dump') else dict(item)
                    if document.get('url') is None:
                        continue  # Unknown links remain in the product-list observation.
                    collection.update_one({'url': document['url']}, {'$set': document}, upsert=True)
                    stored += 1
                console.print(f"Stored {stored} identified product observations", style="green")
                return

            if isinstance(data, list):
                # Check if list is empty
                if not data:
                    console.print(f"⚠️ No data to store in {collection_name} (empty list)", style="yellow")
                    return
                
                # Convert Pydantic models to dict (using model_dump for Pydantic v2)
                documents = [item.model_dump() if hasattr(item, 'model_dump') else item for item in data]
                
                # Handle duplicate key errors gracefully
                try:
                    result = collection.insert_many(documents, ordered=False)
                    console.print(f"✅ Stored {len(result.inserted_ids)} documents in {collection_name}", style="green")
                except DuplicateKeyError as e:
                    # Count successful inserts
                    inserted = len(documents) - len(e.details.get('writeErrors', []))
                    if inserted > 0:
                        console.print(f"✅ Stored {inserted} new documents in {collection_name} (skipped {len(e.details.get('writeErrors', []))} duplicates)", style="green")
                    else:
                        console.print(f"⚠️ All {len(documents)} documents already exist in {collection_name}", style="yellow")
            else:
                # Convert Pydantic model to dict (using model_dump for Pydantic v2)
                document = data.model_dump() if hasattr(data, 'model_dump') else data
                
                # Handle duplicate key errors gracefully
                try:
                    result = collection.insert_one(document)
                    console.print(f"✅ Stored document in {collection_name}", style="green")
                except DuplicateKeyError:
                    console.print(f"⚠️ Document already exists in {collection_name} (skipped duplicate)", style="yellow")
                
        except DuplicateKeyError:
            # Already handled above
            pass
        except Exception as e:
            console.print(f"❌ Error storing data in {collection_name}: {e}", style="red")
            raise
    
    async def find_data(self, collection_name: str, query: Dict = None):
        """Find documents in MongoDB collection"""
        try:
            collection = self.db[collection_name]
            query = query or {}
            documents = list(collection.find(query))
            return documents
        except Exception as e:
            console.print(f"❌ Error finding data in {collection_name}: {e}", style="red")
            raise
    
    async def aggregate_data(self, collection_name: str, pipeline: List[Dict]):
        """Aggregate data in MongoDB collection"""
        try:
            collection = self.db[collection_name]
            results = list(collection.aggregate(pipeline))
            return results
        except Exception as e:
            console.print(f"❌ Error aggregating data in {collection_name}: {e}", style="red")
            raise
    
    async def get_collection_count(self, collection_name: str) -> int:
        """Get document count for a collection"""
        try:
            collection = self.db[collection_name]
            return collection.count_documents({})
        except Exception as e:
            console.print(f"❌ Error getting count for {collection_name}: {e}", style="red")
            return 0
    
    def close(self):
        """Close MongoDB connection"""
        if self.client:
            self.client.close()
            console.print("🔌 MongoDB connection closed", style="blue")

# ========== Web Scraping Functions ==========
class ProductScraper:
    """Handles web scraping operations using Stagehand"""
    
    def __init__(self, stagehand: Stagehand, page: Page, mongodb: MongoDBManager):
        self.stagehand = stagehand
        self.page = page
        self.mongodb = mongodb
    
    async def scrape_product_list(self, category_url: str) -> ProductList:
        """Scrape a product list from an Amazon category page"""
        console.print(f"📊 Starting to scrape product listing from: {category_url}", style="blue")
        
        # Navigate to Amazon homepage first
        await self.page.goto('https://www.amazon.com')
        await self.page.wait_for_timeout(2000)
        
        # Then navigate to the category page
        await self.page.goto(category_url)
        
        # Wait for products to load
        await self.page.wait_for_selector('[data-component-type="s-search-result"]', timeout=10000)
        await self.page.wait_for_timeout(2000)
        
        # Scroll to load more products
        await self.page.evaluate("""
            window.scrollTo(0, document.body.scrollHeight / 2)
        """)
        await self.page.wait_for_timeout(1000)
        
        await self.page.evaluate("""
            window.scrollTo(0, document.body.scrollHeight)
        """)
        await self.page.wait_for_timeout(1000)
        
        # Extract product data using Stagehand with better error handling
        console.print("🔍 Extracting product data with AI...", style="blue")
        
        try:
            # Use Pydantic BaseModel schema as per documentation
            extraction_result = await self.stagehand.extract(
                """Extract all product information from this Amazon category page. For each product, extract:
                - name: ONLY the main product title/name (e.g., "HP 14 Laptop" or "Dell Inspiron 15")
                - price: The current price (if available)
                - url: The actual clickable link/href to the product detail page, or null if no link is visible (NOT the product name)
                - rating: The star rating (if available)
                - reviewCount: Number of reviews (if available)
                - description: The detailed product description with features, specifications, and details (e.g., "Intel Celeron N4020, 4 GB RAM, 64 GB Storage, 14-inch Micro-edge HD Display, Windows 11 Home, Thin & Portable, 4K Graphics, One Year of Microsoft 365")
                - specs: Technical specifications as a dictionary/object with key-value pairs like {"RAM": "16GB", "Storage": "512GB SSD", "Processor": "Intel i7", "Screen": "15.6 inch"} (if available)

                IMPORTANT:
                - The 'url' field must contain the actual product link/href, not the product name.
                - The 'name' field should be SHORT and concise (just the brand and model).
                - The 'description' field should contain the DETAILED product information, features, and specifications.
                - For 'specs', extract any technical details you can see and structure them as key-value pairs.
                - DO NOT put promotional text like "1K+ bought" or "Limited time deal" in the description field.""",
                schema=ProductListExtraction, page=self.page
            )
            
            extraction_data = extraction_result.data
        except Exception:
            raise

        # Resolve links against the final page URL, including redirects.
        source_url = await self.page.url()

        # Process the extracted data
        current_time = datetime.now(timezone.utc)
        products = []
        
        # Handle both ProductListExtraction object and dict formats
        if isinstance(extraction_data, ProductListExtraction):
            products_list = extraction_data.products
            category = extraction_data.category
            total_products = extraction_data.totalProducts
        else:
            products_list = extraction_data.get('products', [])
            category = extraction_data.get('category', 'Unknown')
            total_products = extraction_data.get('totalProducts')
        
        for i, product_data in enumerate(products_list):
            try:
                fields = product_data.model_dump() if isinstance(product_data, ProductExtraction) else product_data
                product = Product(
                    url=normalize_product_url(fields.get('url'), source_url),
                    source_url=source_url,
                    observation_index=i,
                    date_scraped=current_time,
                    name=fields['name'],
                    price=fields['price'],
                    rating=fields.get('rating'),
                    category=category,
                    review_count=fields.get('reviewCount'),
                    description=fields.get('description'),
                    specs=fields.get('specs'),
                )
                products.append(product)
                console.print(f"✅ Processed: {product.name[:50]}...", style="green")
            except Exception as e:
                console.print(f"⚠️ Error processing product: {e}", style="yellow")
                console.print(f"Product data: {product_data}", style="yellow")
        
        # Create the product list object
        product_list = ProductList(
            products=products,
            category=category,
            date_scraped=current_time,
            total_products=total_products or len(products),
            website_name="Amazon"
        )
        
        if not products:
            raise RuntimeError("No products were extracted; no fabricated records will be stored")

        # Store the data in MongoDB
        await self.mongodb.store_data(self.mongodb.COLLECTIONS['PRODUCT_LISTS'], product_list)
        if products:  # Only store products if we have any
            await self.mongodb.store_data(self.mongodb.COLLECTIONS['PRODUCTS'], products)
        
        console.print(f"✅ Scraped {len(products)} products from category: {product_list.category}", style="green")
        return product_list
    

# ========== Data Analysis Functions ==========
class DataAnalyzer:
    """Handles data analysis and reporting"""
    
    def __init__(self, mongodb: MongoDBManager):
        self.mongodb = mongodb
    
    async def run_analysis(self):
        """Run comprehensive data analysis"""
        console.print("\n📊 Running Data Analysis", style="bold blue")
        
        # 1. Collection counts
        await self._show_collection_counts()
        
        # 2. Products by category
        await self._show_products_by_category()
        
        # 3. Top rated products
        await self._show_top_rated_products()
        
        console.print("\n✅ Data analysis completed!", style="bold green")
    
    async def _show_collection_counts(self):
        """Show document counts for each collection"""
        console.print("\n📊 Collection Counts:", style="yellow")
        
        table = Table()
        table.add_column("Collection", style="cyan")
        table.add_column("Count", style="green")
        
        for name, collection in self.mongodb.COLLECTIONS.items():
            count = await self.mongodb.get_collection_count(collection)
            table.add_row(name, str(count))
        
        console.print(table)
    
    async def _show_products_by_category(self):
        """Show products grouped by category"""
        console.print("\n📊 Products by Category:", style="yellow")
        
        pipeline = [
            {"$group": {"_id": "$category", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        
        results = await self.mongodb.aggregate_data(
            self.mongodb.COLLECTIONS['PRODUCTS'], 
            pipeline
        )
        
        if results:
            table = Table()
            table.add_column("Category", style="cyan")
            table.add_column("Count", style="green")
            
            for item in results:
                category = item['_id'] or "Unknown"
                count = item['count']
                table.add_row(category, str(count))
            
            console.print(table)
        else:
            console.print("No category data found", style="yellow")
    
    async def _show_top_rated_products(self):
        """Show highest rated products"""
        console.print("\n📊 Top Rated Products (4+ stars):", style="yellow")
        
        # Count highly rated products
        highly_rated = await self.mongodb.find_data(
            self.mongodb.COLLECTIONS['PRODUCTS'],
            {"rating": {"$gte": 4}}
        )
        
        console.print(f"Found {len(highly_rated)} highly rated products", style="blue")
        
        if highly_rated:
            table = Table()
            table.add_column("Name", style="cyan", max_width=40)
            table.add_column("Price", style="green")
            table.add_column("Rating", style="yellow")
            table.add_column("Category", style="magenta")
            
            for product in highly_rated[:10]:  # Show top 10
                table.add_row(
                    product.get('name', 'N/A')[:37] + "..." if len(product.get('name', '')) > 40 else product.get('name', 'N/A'),
                    product.get('price', 'N/A'),
                    str(product.get('rating', 'N/A')),
                    product.get('category', 'Unknown')
                )
            
            console.print(table)

# ========== Main Application ==========
async def main():
    """Main application function"""
    try:
        # Initialize MongoDB
        mongodb = MongoDBManager(MONGO_URI, DB_NAME)
        await mongodb.connect()
        
        browser = await browserbase.launch(api_key=os.environ["BROWSERBASE_API_KEY"])
        stagehand = await Stagehand.create(browser=browser, dom_settle_timeout_ms=30000)
        page = await browser.context.new_page()
        scraper = ProductScraper(stagehand, page, mongodb)

        # Define category URL
        category_url = "https://www.amazon.com/s?k=laptops"
        
        # Scrape product listing
        product_list = await scraper.scrape_product_list(category_url)
        
        
        # Run data analysis
        analyzer = DataAnalyzer(mongodb)
        await analyzer.run_analysis()
        
        console.print("\n🎉 Scraping and MongoDB operations completed successfully!", style="bold green")
        
    except Exception as e:
        console.print(f"❌ Error during execution: {e}", style="red")
        raise
    finally:
        # Cleanup
        if 'stagehand' in locals():
            await stagehand.close()
        if 'browser' in locals():
            await browser.close()
        if 'mongodb' in locals():
            mongodb.close()

# ========== Entry Point ==========
if __name__ == "__main__":
    # Run the main function
    asyncio.run(main())