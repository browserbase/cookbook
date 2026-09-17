import { NextResponse } from "next/server";
import { browserbase, Stagehand, type Action } from "@browserbasehq/stagehand";

const aliases: Record<string, string[]> = {
  age: ["age", "your age", "how old are you"],
  dependentsUnder17: ["dependentsunder17", "dependents under age 17", "under age 17", "children under age 17"],
  dependents17to23: ["dependents17to23", "dependents age 17-23", "dependents 17-23"],
  wages: ["wages", "w-2 box 1", "salary"],
  federalTax: ["federaltax", "federal tax", "federal income tax withheld", "w-2 box 2"],
  stateTax: ["statetax", "state tax", "state income tax withheld", "w-2 box 17"],
  name: ["name", "full name"],
  email: ["email", "e-mail", "email address"],
  phone: ["phone", "telephone", "phone number"],
  address: ["address", "street address"],
  city: ["city", "town"],
  state: ["state", "province"],
  zip: ["zip", "zip code", "postal code", "zipcode"],
};

const userInputs: Record<string, string> = {
  age: "26", dependentsUnder17: "1", dependents17to23: "0", wages: "54321",
  federalTax: "8345", stateTax: "2222", name: "John Doe", email: "john.doe@example.com",
  phone: "555-123-4567", address: "123 Main St", city: "Anytown", state: "CA", zip: "12345",
};

function inspectFields(input: { selectors: string[]; aliases: Record<string, string[]> }) {
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
  return input.selectors.map(selector => {
    let elements: Element[];
    if (/^xpath=/i.test(selector) || selector.startsWith("/") || selector.startsWith("(")) {
      const result = document.evaluate(selector.replace(/^xpath=/i, ""), document, null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      elements = Array.from({ length: result.snapshotLength }, (_, index) => result.snapshotItem(index))
        .filter((node): node is Element => node instanceof Element);
    } else {
      elements = Array.from(document.querySelectorAll(selector));
    }
    if (elements.length !== 1) throw new Error("A field target is missing or ambiguous.");
    const element = elements[0];
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)
      || (element instanceof HTMLInputElement && !["text", "number", "email", "tel", "search", "url"].includes(element.type))
      || element.disabled || element.readOnly || element.getClientRects().length === 0
      || getComputedStyle(element).visibility !== "visible") {
      throw new Error("The target is not an editable visible text field.");
    }
    const labelIds = (element.getAttribute("aria-labelledby") ?? "").trim().split(/\s+/).filter(Boolean);
    const ariaLabel = labelIds.map(id => {
      const labels = Array.from(document.querySelectorAll("[id]")).filter(node => node.id === id);
      if (labels.length !== 1) throw new Error("A field label is missing or ambiguous.");
      return labels[0].textContent ?? "";
    }).join(" ");
    const labels = [element.id, element.name, element.getAttribute("aria-label") ?? "", ariaLabel,
      ...Array.from(element.labels ?? [], label => label.textContent ?? "")].map(normalize).filter(Boolean);
    const keys = Object.entries(input.aliases).filter(([, names]) => names.some(name => labels.includes(normalize(name))))
      .map(([key]) => key);
    if (keys.length !== 1) throw new Error("The field labels are unknown or ambiguous.");
    const parts: string[] = [];
    let current: Element | null = element;
    while (current) {
      const tag = current.localName;
      let index = 1;
      let sibling = current.previousElementSibling;
      while (sibling) {
        if (sibling.localName === tag) index++;
        sibling = sibling.previousElementSibling;
      }
      parts.unshift(`${tag}[${index}]`);
      current = current.parentElement;
    }
    return { selector: `xpath=/${parts.join("/")}`, key: keys[0], value: element.value };
  });
}

export async function GET() {
  let browser: Awaited<ReturnType<typeof browserbase.launch>> | undefined;
  let stagehand: Stagehand | undefined;
  let response: { url: string; fields: { name: string; value: string }[]; count: number } | undefined;
  const failures: unknown[] = [];
  try {
    const url = "https://file.1040.com/estimate/";
    const apiKey = process.env.BROWSERBASE_API_KEY;
    if (!apiKey) throw new Error("BROWSERBASE_API_KEY is required");
    browser = await browserbase.launch({
      apiKey,
      browserSettings: { viewport: { width: 1920, height: 1080 } },
    });
    stagehand = await Stagehand.create({ browser, selfHeal: false });
    const page = await browser.context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const { data: observed } = await stagehand.observe("Find the editable text fields to fill with mock data", { page, timeout: 30_000 });
    if (!Array.isArray(observed) || observed.length === 0 || observed.some(candidate =>
      candidate.method !== "fill" || typeof candidate.selector !== "string" || !candidate.selector.trim())) {
      throw new Error("Only explicit fill targets are supported.");
    }
    const fields = await page.evaluate(inspectFields, { selectors: observed.map(candidate => candidate.selector), aliases });
    if (new Set(fields.map(field => field.selector)).size !== fields.length
      || new Set(fields.map(field => field.key)).size !== fields.length) {
      throw new Error("Duplicate field targets or labels are not supported.");
    }
    const verify = async (expected: typeof fields) => {
      const actual = await page.evaluate(inspectFields, { selectors: expected.map(field => field.selector), aliases });
      if (actual.length !== expected.length || actual.some((field, index) =>
        field.selector !== expected[index].selector || field.key !== expected[index].key
        || field.value !== userInputs[field.key])) throw new Error("A filled field could not be verified.");
    };
    for (const field of fields) {
      const current = await page.evaluate(inspectFields, { selectors: [field.selector], aliases });
      if (current.length !== 1 || current[0].selector !== field.selector || current[0].key !== field.key) {
        throw new Error("The field target changed before filling.");
      }
      const action: Action = { selector: field.selector, description: `Fill ${field.key}`,
        method: "fill", arguments: [userInputs[field.key]] };
      const result = await stagehand.act(action, { page, timeout: 30_000 });
      if (result.data.success !== true) throw new Error("A fill action failed.");
      await verify([field]);
    }
    await verify(fields);
    response = { url, fields: fields.map(field => ({ name: field.key, value: userInputs[field.key] })), count: fields.length };
  } catch (error) {
    failures.push(error);
  } finally {
    if (stagehand) {
      try { await stagehand.close(); } catch (error) { failures.push(error); }
    }
    if (browser) {
      try { await browser.close(); } catch (error) { failures.push(error); }
    }
  }
  if (failures.length || !response) return NextResponse.json({ message: "Failed to fill form" }, { status: 500 });
  return NextResponse.json(response);
}
