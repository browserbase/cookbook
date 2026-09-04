// Unified check: oracle (passed) + probe (measurements + instructionToFixer).
export default {
  expression: `(async () => {
    const buttons = [...document.querySelectorAll("button")];
    const output = document.querySelector("output");
    const before = output?.textContent ?? "";
    buttons.find((b) => b.textContent === "+")?.click();
    await new Promise((r) => setTimeout(r, 50));
    const afterPlus = output?.textContent ?? "";
    buttons.find((b) => b.textContent === "-")?.click();
    await new Promise((r) => setTimeout(r, 50));
    const afterMinus = output?.textContent ?? "";
    return {
      passed: afterPlus === "2" && afterMinus === "1",
      before,
      afterPlus,
      afterMinus,
      passCondition: "clicking + moves the quantity output from 1 to 2, and clicking - returns it to 1",
      instructionToFixer: "The plus button must increment quantity by exactly one and the minus button must decrement without going below one. Inspect the increment handler's arithmetic."
    };
  })()`
};
