# Hacker News Intelligence Demo

> **Enterprise-grade Browserbase automation demo for news aggregation and content intelligence**

This demonstration showcases Browserbase's cloud browser automation capabilities through an AI-powered Hacker News intelligence system. Built with Stagehand's natural language automation framework, it demonstrates how enterprises can automate complex web workflows for competitive intelligence, content research, and trend analysis.

## 🎯 What This Demo Does

The demo performs comprehensive Hacker News intelligence gathering:

1. **🔍 Intelligent Post Discovery**: Navigates to Hacker News and extracts the top trending posts using AI-powered element detection
2. **📖 Content Analysis**: Automatically visits external links and extracts key insights from articles
3. **🤖 AI-Powered Categorization**: Analyzes content for business relevance, sentiment, and technical complexity
4. **📊 Executive Reporting**: Generates structured intelligence reports with actionable insights
5. **🎛️ Enterprise Configuration**: Provides customizable parameters for different use cases

## 🏢 Business Value for Enterprise Customers

- **Competitive Intelligence**: Monitor trending technologies and startup activities
- **Content Strategy**: Identify popular topics for content marketing and thought leadership
- **Market Research**: Track sentiment and engagement around industry topics
- **Developer Relations**: Stay current with developer community interests and concerns
- **Investment Research**: Analyze startup and technology trends for investment decisions

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn
- Browserbase account with API key
- 5 minutes for setup

### 1. Clone and Install

```bash
cd content-and-research/sample-01/intelligence-demo
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your Browserbase credentials:

```env
BROWSERBASE_API_KEY=your_browserbase_api_key_here
BROWSERBASE_PROJECT_ID=your_project_id_here

# Optional customization
MAX_POSTS=5
ENABLE_CONTENT_EXTRACTION=true
LOG_LEVEL=info
```

### 3. Verify Setup

```bash
npm run test
# or
npm run dev -- --health-check
```

### 4. Run the Demo

```bash
npm run dev
```

## 📖 How to Use This Demo

### Basic Usage

The demo runs automatically once started:

```bash
npm run dev
```

**What happens during execution:**

1. **Initialization**: Establishes secure Browserbase session with residential proxies
2. **Navigation**: Opens Hacker News front page using cloud browser infrastructure
3. **AI Extraction**: Uses Stagehand's natural language commands to identify and extract post data
4. **Content Analysis**: Visits external links and extracts article content using intelligent parsing
5. **Intelligence Generation**: Applies AI analysis for categorization, sentiment, and business relevance scoring
6. **Report Generation**: Creates comprehensive reports in both console and JSON formats

### Configuration Options

Customize the demo behavior through environment variables:

```env
# Number of posts to analyze (1-30)
MAX_POSTS=10

# Enable/disable full content extraction
ENABLE_CONTENT_EXTRACTION=true

# Logging verbosity
LOG_LEVEL=debug  # debug, info, warn, error

# Request timeout
TIMEOUT_MS=45000
```

### Output Formats

The demo generates multiple output formats:

- **Console Display**: Rich formatted output with colors and emojis
- **JSON Reports**: Structured data saved to `reports/` directory
- **Executive Summary**: Business-focused insights for stakeholders

## 🏗️ Technical Architecture

### Built with Enterprise-Grade Technologies

- **Browserbase Cloud Platform**: Scalable browser automation infrastructure
- **Stagehand AI Framework**: Natural language web automation
- **TypeScript**: Type-safe development with comprehensive error handling
- **Advanced Logging**: Structured logging with multiple verbosity levels
- **Graceful Error Handling**: Robust error recovery and reporting

### Key Components

```
src/
├── main.ts          # Main orchestration and CLI interface
├── extractor.ts     # AI-powered content extraction logic
├── reporter.ts      # Intelligence report generation
├── config.ts        # Environment and runtime configuration
├── logger.ts        # Enterprise logging system
├── types.ts         # TypeScript type definitions
└── test.ts          # Automated testing suite
```

### Stagehand Integration Highlights

The demo showcases advanced Stagehand capabilities:

```typescript
// Natural language automation
await page.act("Extract the top 5 trending posts with all metadata");

// Intelligent content analysis
const insights = await page.extract(`
  Analyze this article and provide:
  - Key business insights
  - Technical complexity assessment
  - Market relevance score
`);

// Adaptive element detection
await page.observe("Check if content loaded successfully");
```

## 🔧 Troubleshooting

### Common Issues

**Error: "BROWSERBASE_API_KEY is required"**
- Ensure `.env` file exists with valid API credentials
- Verify API key is active in your Browserbase dashboard

**Error: "No posts extracted"**
- Check internet connectivity
- Verify Hacker News is accessible
- Try running with `LOG_LEVEL=debug` for detailed information

**Slow Performance**
- Reduce `MAX_POSTS` for faster testing
- Disable content extraction: `ENABLE_CONTENT_EXTRACTION=false`
- Check Browserbase region settings in `src/config.ts`

### Advanced Debugging

Enable verbose logging:

```bash
LOG_LEVEL=debug npm run dev
```

Run health check:

```bash
npm run dev -- --health-check
```

Check Browserbase sessions:
- View active sessions in your Browserbase dashboard
- Use Session Inspector URLs provided in debug output
- Review Session Replay for detailed interaction analysis

## 🎛️ Customization for Your Use Case

### Industry-Specific Adaptations

**Financial Services**: Focus on fintech and blockchain posts
```typescript
// Modify src/extractor.ts
const targetCategories = ['fintech', 'blockchain', 'trading', 'banking'];
```

**Healthcare**: Monitor health tech and biotech trends
```typescript
// Custom extraction parameters
const healthcareKeywords = ['healthtech', 'biotech', 'medical', 'pharma'];
```

**Enterprise SaaS**: Track SaaS and enterprise technology
```typescript
// Business relevance scoring adjustments
const enterpriseWeight = 1.5; // Boost enterprise-focused content
```

### Scaling for Production

**High-Volume Processing**:
```typescript
// Parallel processing configuration
const browserbaseConfig = {
  concurrent: 5,        // Multiple browser sessions
  rateLimiting: true,   // Respect rate limits
  retryLogic: 3        // Automatic retry on failures
};
```

**Data Integration**:
```typescript
// Export to external systems
await exportToSlack(report);
await saveToDatabase(analyses);
await sendToDataWarehouse(intelligenceData);
```

## 🔐 Security and Compliance

This demo implements enterprise security best practices:

- **No Data Persistence**: No sensitive data stored locally
- **Secure Sessions**: All browser sessions use Browserbase's secure infrastructure
- **Configurable Privacy**: Session recording can be disabled for compliance
- **Rate Limiting**: Respects website rate limits and robots.txt
- **Error Isolation**: Failed extractions don't impact overall execution

## 📊 Performance Metrics

Typical performance benchmarks:

- **5 Posts**: ~30-45 seconds
- **10 Posts**: ~60-90 seconds
- **20 Posts**: ~120-180 seconds

Performance factors:
- Content extraction enabled/disabled
- Network latency to target sites
- Browserbase region selection
- Article length and complexity

## 🚀 Next Steps for Enterprise Implementation

### Immediate Enhancements

1. **Scheduling**: Add cron jobs for regular intelligence gathering
2. **Notifications**: Integrate with Slack, Teams, or email for alerts
3. **Data Storage**: Connect to databases or data warehouses
4. **Custom Sources**: Extend beyond Hacker News to industry-specific sites

### Advanced Features

1. **Multi-Source Aggregation**: Reddit, Product Hunt, GitHub trending
2. **Sentiment Tracking**: Historical sentiment analysis and trending
3. **Competitor Monitoring**: Track specific companies or technologies
4. **AI Summarization**: Generate executive briefings and trend reports

### Enterprise Integration

1. **API Development**: RESTful API for integration with existing systems
2. **Dashboard Creation**: Real-time intelligence dashboards
3. **Workflow Automation**: Integration with marketing and research workflows
4. **Custom Analytics**: Business-specific KPIs and metrics

## 🤝 Support and Professional Services

This demo represents a starting point for enterprise automation workflows. For production implementation, custom development, or integration support:

- **Technical Support**: Contact your Browserbase customer success team
- **Custom Development**: Professional services available for enterprise customization
- **Training**: Workshops and training sessions for your development team
- **Architecture Review**: Best practices consultation for large-scale deployments

---

**Built with ❤️ using Browserbase and Stagehand**

*This demo showcases the power of cloud browser automation for enterprise intelligence gathering. Ready to see how Browserbase can transform your web automation workflows?*
### What the health check verifies

`npm run dev -- --check-config` checks the demo's required configuration without allocating a browser. It does not validate credentials against the service.

`npm run dev -- --health-check` first validates configuration, then launches its own Browserbase browser, opens a new page, and requires HTTP 200 from `https://httpbin.org/status/200`. It requests cleanup on both success and failure. This checks browser connectivity, not extraction quality, model credentials, reporting, or the complete demo workflow. A failure at the external check endpoint can also make the check fail.

Launch reporting has a 30-second deadline, page creation 10 seconds, navigation 15 seconds with a 10-second navigation timeout, and cleanup 10 seconds. A launch that finishes after its deadline is still cleaned up. The browser requests a 60-second session lifetime as a backstop. These deadlines do not cancel underlying SDK operations; the CLI can remain alive while those operations finish. Successful cleanup means the SDK cleanup request completed, not that terminal session shutdown was independently observed. Force termination or the existing signal handlers can interrupt cleanup.

Credential-free regression checks:

```sh
node --test tests/health-check.test.cjs
```

Run these tests with Node 24. They exercise the actual health-check source with synthetic browser responses and controlled timers, including late allocation and cleanup failure. They do not make live Browserbase or model calls.
