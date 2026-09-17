import { chromium } from "@playwright/test";

// Define createSession function instead:
async function createSession() {
  // Add your session creation logic here
  const response = await fetch("https://api.browserbase.com/v1/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-BB-API-Key": process.env.BROWSERBASE_API_KEY!,
    },
    body: JSON.stringify({
    }),
  });
  const data = await response.json();
  return {
    id: data.id,
    connectUrl: data.connectUrl,
  };
}

(async () => {
  const sleep = async () =>
    await new Promise((resolve) =>
      setTimeout(resolve, Math.floor(50 + Math.random() * 100)),
    );
  const { id, connectUrl } = await createSession();
  //   sessionId = id;
  const browser = await chromium.connectOverCDP(connectUrl);
  const defaultContext = browser.contexts()[0];
  const page = defaultContext.pages()[0];
  const targetFormUrl = process.env.TARGET_FORM_URL;
  if (!targetFormUrl) throw new Error("TARGET_FORM_URL is required");
  await page.goto(targetFormUrl, { waitUntil: "load" });
  await page.waitForSelector(
    'text="Is this an issue related to counterfeit goods?"',
  );
  /*
    Contact information
  */
  //Locate your full name input
  const yourNameInput = page.locator('input[id="tux-2_input"]');
  await yourNameInput.fill(process.env.REPORTER_NAME ?? "Alex Example");
  await sleep();
  //Locate your name of the trademark owner input
  const trademarkOwnerInput = page.locator('input[id="tux-3_input"]');
  await trademarkOwnerInput.fill(process.env.TRADEMARK_OWNER ?? "Example Company");
  await sleep();
  //Locate the physical address input
  const physicalAddressInput = page.locator('input[id="tux-4_input"]');
  await physicalAddressInput.fill(process.env.REPORTER_ADDRESS ?? "123 Example Street, Example City, CA 94100");
  await sleep();
  //Locate the physical address input
  const phoneNumberInput = page.locator('input[id="tux-5_input"]');
  await phoneNumberInput.fill("0000000000");
  await sleep();
  /*
    Issue Type
  */
  /*
    Pick one of these:
      "yes"
      "no"
  */
  const relatedToCountergoods = "yes";
  await page.evaluate((relatedToCountergoods) => {
    const check = document.querySelector(
      `input[name="extra.cfGoods"][id="extra_cfgoods_${relatedToCountergoods}"]`,
    );
    if (check) {
      check.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  }, relatedToCountergoods);
  await sleep();
  /*
    Trademark ownership
  */
  /*
    Pick one of these:
      "I am the trademark owner"
      "I am an host, officer, or director (non-legal) of the trademark owner"
      "I am the legal counsel to the trademark owner"
      "I am an employee of the trademark owner"
      "I am an authorized agent of the trademark owner"
  */
  //Please pick a value from the map above.
  const relationshipToOwnerValue =
    "I am an host, officer, or director (non-legal) of the trademark owner";
  await page.evaluate((relationshipToOwnerValue) => {
    const check = document.querySelector(
      `input[name="relationship"][id="${relationshipToOwnerValue}"]`,
    );
    if (check) {
      check.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  }, relationshipToOwnerValue);
  await sleep();
  //Locate the proof of authorization
  const proofOfAuthorization = await page.$("#input-file-authorizations");
  if (!proofOfAuthorization) {
    throw new Error("Could not find proof of authorization input");
  }
  await proofOfAuthorization.setInputFiles("bb.jpeg");
  await sleep();
  /*
    Trademark registration info
  */
  //Locate "Jurisdiction of registration" input
  const jurisdictionInput = page.locator('input[id="tux-14_input"]');
  await jurisdictionInput.fill("USA");
  await sleep();
  //Locate "Registration number" input
  const registrationNumberInput = page.locator('input[id="tux-15_input"]');
  await registrationNumberInput.fill("123456789");
  await sleep();
  //Locate "Trademarked goods and service class" input
  const trademarkedGoodsInput = page.locator('input[id="tux-16_input"]');
  await trademarkedGoodsInput.fill("042");
  await sleep();
  //Locate "Scan of trademark registration certificate" upload
  const trademarkRegistration = await page.$("#input-file-certificate");
  if (!trademarkRegistration) {
    throw new Error("Could not find trademark registration input");
  }
  await trademarkRegistration.setInputFiles("bb.jpeg");
  await sleep();
  //Locate "URL of your trademark record" input
  const urlOfTrademark = page.locator('input[id="tux-17_input"]');
  await urlOfTrademark.fill("https://browserbase.com");
  await sleep();
  /*
    Content to report
  */
  //Locate URLS textbox
  const urlsTextbox = page.locator('textarea[id="tux-18_textArea"]');
  await urlsTextbox.fill(
    "https://www.tiktok.com/@randomspamvideos25/video/7251387037834595630?lang=en",
  );
  await sleep();
  //Set here first the value if the reported content was taken from your personal TikTok account
  /*
    Pick one of these:
      "yes"
      "no"
  */
  const takenFromAccount = "yes";
  await page.evaluate((takenFromAccount) => {
    const check = document.querySelector(
      `input[name="personalAccount"][id="ip_report_webform_personal_acct_${takenFromAccount}"]`,
    );
    if (check) {
      check.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  }, takenFromAccount);
  await sleep();
  if (takenFromAccount === "yes") {
    //Locate personal tiktok account input
    const personalTiktokAccountInput = page.locator('input[id="tux-26_input"]');
    await personalTiktokAccountInput.fill("@synthetic_creator");
    await sleep();
  }
  //Locate description infringed upon input
  const descriptionInfringedInput = page.locator('input[id="tux-21_input"]');
  await descriptionInfringedInput.fill(
    "Browserbase the best framework for controlling headless browsers",
  );
  await sleep();
  /*
    Additional materials (optional)
  */
  //Locate additional materials upload
  const additionalMaterials = await page.$("#input-file-attachment");
  if (!additionalMaterials) {
    throw new Error("Could not find additional materials input");
  }
  await additionalMaterials.setInputFiles("bb.jpeg");
  /*
    Statement
  */
  await page.evaluate(() => {
    for (let i = 1; i < 4; i++) {
      const checks = document.querySelectorAll(
        `input[data-tux-checkbox-input=true]`,
      );
      if (checks.length) {
        checks.forEach((check) =>
          check.dispatchEvent(new MouseEvent("click", { bubbles: true })),
        );
      }
    }
  });
  /*
    Signature
  */
  //Locate signature input
  const signatureInput = page.locator('input[id="tux-25_input"]');
  await signatureInput.fill("Alex Example");
  await sleep();
  /*
  Send
  */
  if (process.env.ALLOW_SUBMIT !== "true") {
    console.log("Prepared the example form without submitting it. Set ALLOW_SUBMIT=true only after an authorized review.");
    await browser.close();
    return;
  }
  // Click the Send button only after explicit authorization.
  await page.evaluate(() => {
    const check = document.querySelector(`button[class="submit-button  "]`);
    if (check) {
      check.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  });
})();
