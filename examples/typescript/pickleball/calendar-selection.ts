import type { Stagehand, Page } from "@browserbasehq/stagehand";

type CalendarState = { months: string[]; selected: string[] };
export async function calendarState(page: Page): Promise<CalendarState> {
  return await page.evaluate("(() => {\n      const visible = e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';\n      const cells = [...document.querySelectorAll('[role=\"gridcell\"][data-day]')]\n        .filter(e => visible(e) && !e.hasAttribute('data-outside'));\n      return {\n        months: [...new Set(cells.map(e => e.getAttribute('data-day').slice(0, 7)))],\n        selected: cells.filter(e => e.getAttribute('aria-selected') === 'true').map(e => e.getAttribute('data-day'))\n      };\n    })()") as CalendarState;
}

export async function selectCalendarDate(stagehand: Stagehand, page: Page, selectedDate: string): Promise<void> {
  const parsed = new Date(`${selectedDate}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== selectedDate) {
    throw new Error("Expected a valid YYYY-MM-DD calendar date");
  }
  const targetMonth = selectedDate.slice(0, 7);
  const openCalendar = async () => {
    const result = await stagehand.act("Open the booking date picker or calendar", { page });
    if (result.data.success !== true) throw new Error("Could not open the booking date picker");
  };
  await openCalendar();
  for (let transition = 0; transition <= 120; transition++) {
    const { months } = await calendarState(page);
    if (months.length !== 1 || !/^\d{4}-\d{2}$/.test(months[0])) throw new Error("Cannot identify one visible calendar month");
    if (months[0] === targetMonth) break;
    if (transition === 120) throw new Error("Requested calendar month was not reached within 120 transitions");
    const direction = months[0] < targetMonth ? "next" : "previous";
    const button = page.locator(`button.rdp-button_${direction}`);
    if (await button.count() !== 1 || !await button.isVisible()) throw new Error("Calendar navigation control is missing or ambiguous");
    await button.click();
    let changed = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      if ((await calendarState(page)).months.join() !== months.join()) { changed = true; break; }
      await page.waitForTimeout(100);
    }
    if (!changed) throw new Error("Calendar month did not change after navigation");
  }
  const cell = page.locator(`[role="gridcell"][data-day="${selectedDate}"]:not([data-outside]):not([data-disabled]) button`);
  if (await cell.count() !== 1 || !await cell.isVisible()) throw new Error("Requested full date is not uniquely available in the calendar");
  await cell.click();
  let state = await calendarState(page);
  if (!state.months.length) { await openCalendar(); state = await calendarState(page); }
  if (state.months.length !== 1 || state.months[0] !== targetMonth || state.selected.length !== 1 || state.selected[0] !== selectedDate) {
    throw new Error("The booking calendar did not confirm the requested full date");
  }
  await page.keyPress("Escape");
}
