# Braintrust Integration

Utilize Browserbase with Braintrust for advanced browser automation.

## Overview

Braintrust is a platform for building AI applications, making it more efficient for Large Language Models (LLMs) to become more robust, reliable, and interactive.

### Key Features

- Prototyping with different prompts and LLMs in a sandboxed environment
- Real-time monitoring and performance insights  
- Data management through intuitive UI

## Tool Calling Support

Most Large Language Models support tool calling, which allows you to define tools with well-defined input and output types. Common use cases include:

1. Enabling models to "call" tools that perform external tasks and use those results to produce a final response
2. Coercing models into producing structured outputs that match a given JSON schema

Braintrust supports both use cases, allowing prompts to be executed directly using TypeScript or Python.

### Custom Functions

Custom functions enhance LLM capabilities by enabling:

- Web-browsing capabilities (using tools like Browserbase)
- Complex computations
- External API access

## Session cleanup and verification

Each SDK or raw API tool call owns one Browserbase session with a five-minute timeout. The handler closes its CDP connection and explicitly requests session release in `finally`, including after connection, navigation or extraction failures. Release still runs if close fails. If both the operation and cleanup fail, the returned error preserves both causes. The raw API variant checks HTTP status, JSON and the session ID before connecting.

Run `npm test` inside this package after installing its dependencies. Tests invoke the registered handlers with synthetic Browserbase, Playwright and Braintrust boundaries; they cover success, acquisition/operation/cleanup failures and malformed HTTP responses without registering remote tools or opening real sessions. They do not verify live Braintrust registration or provider behavior.
