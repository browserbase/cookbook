# Browserbase + Trigger.dev Integration

## Overview

Trigger.dev is a background job framework that enables you to create, run, and monitor background tasks with built-in retry logic, scheduling, and observability. This integration showcases multiple use cases:

- **PDF Processing**: Convert PDFs to images and upload to cloud storage
- **Web Scraping**: Extract data from websites using Puppeteer and Browserbase
- **Document Generation**: Create PDFs from React components
- **Email Automation**: Scheduled tasks with email notifications
- **Task Hierarchies**: Complex workflows with parent-child task relationships

## Task Examples

### 1. PDF to Image Conversion (`pdf-to-image.tsx`)
Converts PDF documents to PNG images using MuPDF and uploads them to Cloudflare R2 storage.

**Features:**
- Downloads PDF from URL
- Converts each page to PNG using `mutool`
- Uploads images to R2 bucket
- Returns array of image URLs
- Automatic cleanup of temporary files

### 2. Puppeteer Web Scraping (`puppeteer-*.tsx`)

#### Basic Page Title Extraction
The first worker check launches Puppeteer with an owned HTML fixture, verifies its title, returns `{ "title": "Browserbase cookbook worker check" }`, and closes the browser. It does not navigate to an external website.

#### Scraping with Browserbase Proxy
Uses Browserbase's cloud browser infrastructure to scrape data through a proxy:
- Connects to Browserbase WebSocket endpoint
- Scrapes GitHub star count from trigger.dev website
- Handles errors gracefully

#### Webpage to PDF Generation
Converts web pages to PDF documents:
- Navigates to target URL
- Generates PDF from webpage
- Uploads PDF to cloud storage

### 3. React PDF Generation (`react-pdf.tsx`)
Creates PDF documents using React components and @react-pdf/renderer:
- Accepts text payload
- Renders PDF using React components
- Uploads generated PDF to cloud storage
- Returns PDF URL

### 4. Hacker News Summarization (`summarize-hn.tsx`)
Scheduled task that runs weekdays at 9 AM (London time):

**Workflow:**
1. **Scrapes Hacker News** - Gets top 3 articles
2. **Batch Processing** - Triggers child tasks for each article
3. **Content Extraction** - Scrapes full article content
4. **AI Summarization** - Uses OpenAI GPT-4 to create summaries
5. **Review** - Returns complete summaries and rendered email HTML without sending

The scheduled task fails if any child summary fails or is empty; it does not silently send a partial digest. Review its `articles` and `html` output first. To send a reviewed digest, invoke the separate `send-hacker-news-summary` task explicitly:

```json
{
  "send": true,
  "deliveryId": "your-reviewed-digest-id",
  "articles": [
    { "title": "Reviewed title", "link": "https://example.com/article", "summary": "Reviewed summary." }
  ]
}
```

Set `RESEND_API_KEY`, `HN_EMAIL_FROM` (a verified sender) and `HN_EMAIL_TO` (your intended recipient). Use single bare email addresses. There are no default recipients. The sender validates the payload and requires a provider ID without an error before returning `status: "accepted"`; acceptance does not establish inbox delivery.

Sending has one automatic attempt. Reuse the same `deliveryId` and unchanged payload for a deliberate retry within Resend's 24-hour idempotency window. A new ID or a retry after that window can send another email. See [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).

Run `node --test tests/summarize-hn.test.cjs` for synthetic task tests. They cover draft-only scheduling, incomplete child results, explicit send/configuration checks, provider rejection and acceptance. No email or cloud task is run by these tests.

**Features:**
- Scheduled execution with cron syntax
- Batch task processing with `batchTriggerAndWait`
- Retry logic with exponential backoff
- Request interception to optimize scraping
- Email templates using React Email

### 5. Task Hierarchy (`taskHierarchy.ts`)
Demonstrates complex task workflows with parent-child relationships:
- **Root Task** → **Child Task** → **Grandchild Task** → **Great-grandchild Task**
- Shows both synchronous (`triggerAndWait`) and asynchronous (`trigger`) patterns
- Batch processing capabilities
- Run hierarchy logging and visualization

## Configuration

`trigger.config.ts` requires `TRIGGER_PROJECT_REF` from your own project's settings and explicitly discovers tasks in `./src/trigger`. There is no default project. The build extensions provide Puppeteer and production MuPDF tools; local PDF conversion also requires `mutool` and `curl` on your machine.

`package.json` owns dependency versions. The task-worker script pins the CLI to 4.5.16, matching the declared SDK and build packages. These packages are currently below the local seven-day package-age cutoff; full installation and worker execution remain unverified.

## Environment Variables

Create a `.env.local` file in your project root with the following variables:

```bash
# Trigger.dev Configuration
TRIGGER_PROJECT_REF=proj_replace_with_your_project
TRIGGER_SECRET_KEY=your-development-environment-secret-key

# Browserbase Configuration (for web scraping)
BROWSERBASE_API_KEY=your-browserbase-api-key
BROWSERBASE_PROJECT_ID=your-browserbase-project-id

# Cloudflare R2 Storage Configuration (for file uploads)
S3_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
S3_BUCKET=your-r2-bucket-name

# OpenAI Configuration (for AI summarization)
OPENAI_API_KEY=your-openai-api-key

# Resend Configuration (for email delivery)
RESEND_API_KEY=your-resend-api-key
HN_EMAIL_FROM=your-verified-sender-address
HN_EMAIL_TO=your-recipient-address
```

## Run the first background task

1. Install dependencies inside this directory with `npm install`. Respect your package-age policy. Create your own Trigger.dev project, copy its project reference, and authenticate the pinned CLI with `npx trigger.dev@4.5.16 login`.
2. Set `TRIGGER_PROJECT_REF` in the worker terminal's environment. It must identify your project; do not reuse the former upstream project ID. Configure the task-specific variables below only for tasks you intend to run.
3. Start the worker with `npm run dev:tasks`. Keep it running and wait for registration of `puppeteer-log-title`. A web server listening on port 3000 is not evidence of worker readiness.
4. In the dashboard, choose your project's **Development** environment, open `puppeteer-log-title` from Tasks, press **Test**, enter `{}`, and choose **Run test**.
5. Verify that the run completes and its output is `{ "title": "Browserbase cookbook worker check" }`. A queued run, task registration, or a log message alone does not prove completion. The task must read the expected title and finish browser cleanup before succeeding.

The first task needs Trigger.dev CLI authentication and a local Puppeteer browser, but no Browserbase, storage, model, or email credentials. Its browser fixture does not contact an external website. Starting a worker still connects to Trigger.dev and a dashboard test creates a task run.

To view the optional setup page, run `npm run dev:web` in a separate terminal and open `http://localhost:3000`. The page gives instructions; it does not collect resume data or submit tasks. The historical `/api` PDF-conversion endpoint is separate from Trigger.dev and is not a worker test.

Environment loading differs between Next.js and Trigger.dev: `.env.local` supports the web application, while CLI `--env-file` hydrates the CLI process only. Configure development task variables through Trigger.dev's supported environment setup and verify their presence in your own worker before invoking service-dependent tasks. Keep keys out of payloads and logs.

After the first worker check, inspect a selected task's payload and service requirements. For example, the React PDF task accepts `{ "text": "Synthetic cookbook document" }` and uploads an artifact using the storage configuration below. This is a separate external write operation. Review the scheduled HN and explicit email-send instructions before enabling either.

An authenticated development-worker run and full dependency build have not been performed during cookbook verification. Complete those checks before preparing a deployment; this quickstart does not claim deployment readiness.

See [CLI development worker](https://trigger.dev/docs/cli-dev-commands), [project configuration](https://trigger.dev/docs/config/config-file), and [dashboard tests](https://trigger.dev/docs/run-tests).

## Machine Presets

Tasks can specify machine requirements:
```typescript
export const puppeteerBasicTask = task({
  id: "puppeteer-log-title",
  machine: {
    preset: "large-1x",
  },
  // ...
});
```

Available presets provide different CPU/memory configurations for resource-intensive tasks.

## Error Handling & Retries

The examples demonstrate the following mechanisms; inspect each task and its tests before relying on them:
- **Automatic retries** with exponential backoff
- **Resource cleanup** (browser instances, temporary files)
- **Detailed logging** for debugging
- **Graceful failure** handling

## Integration Services

This example integrates with several external services:
- **Browserbase**: Cloud browser infrastructure for web scraping
- **Cloudflare R2**: Object storage for files
- **OpenAI**: AI-powered content summarization
- **Resend**: Email delivery service
- **React Email**: Email template rendering

## Use Cases

Perfect for:
- **Document processing workflows**
- **Web scraping and data extraction**
- **Automated content generation**
- **Scheduled reporting and notifications**
- **Complex multi-step background processes**


## PDF and image download configuration

The PDF/image tasks require `S3_BUCKET` and `S3_PUBLIC_BASE_URL` before generating output. Set the latter to the public HTTPS base that serves objects from that bucket, optionally with a path prefix. For example, an object key `pdfs/<unique-id>/page.pdf` and base `https://downloads.example.com/assets` produce `https://downloads.example.com/assets/pdfs/<unique-id>/page.pdf`. Do not use the R2 S3 API endpoint as a public download host.

These samples assume you have deliberately configured public access for the generated artifacts. They do not enable public bucket access or provide signed private downloads. Use synthetic content for this public-download workflow. For private documents, add a signed-download or authenticated delivery mechanism before using the sample. A configured URL is not proof that your domain or access policy works; verify those in your own deployment.

Each invocation generates a unique directory, including repeated conversions of the same document ID. PDF results include the uploaded bucket/key as well as the URL. A task returns URLs only after its corresponding upload succeeds. Failed or retried multi-image runs can leave previously uploaded objects; object retention/cleanup is a separate policy. Upload logs contain keys rather than document bodies.

Run `node --test tests/*.test.cjs` for synthetic task/storage tests. They verify concurrent key isolation, configured URL mapping, early configuration failures and upload rejection without writing cloud objects.


Browser examples share a finally-based cleanup helper around all page work, starting before `newPage()`. It closes acquired browsers on success or failure and preserves both errors if an operation and close fail. HN extraction and PDF generation release browsers before later model, batch, rendering or upload work. PDF buffers remain in memory; PDF-to-image removes its temporary directory in finally, including failed conversion/uploads. Cloud object retention remains the separate policy described above.
