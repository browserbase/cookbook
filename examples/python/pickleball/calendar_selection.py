"""Select and verify a full date using the booking site's DayPicker attributes."""

from datetime import date
import re


async def calendar_state(page) -> dict:
    return await page.evaluate("""(() => {
      const visible = e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
      const cells = [...document.querySelectorAll('[role="gridcell"][data-day]')]
        .filter(e => visible(e) && !e.hasAttribute('data-outside'));
      return {
        months: [...new Set(cells.map(e => e.getAttribute('data-day').slice(0, 7)))],
        selected: cells.filter(e => e.getAttribute('aria-selected') === 'true').map(e => e.getAttribute('data-day'))
      };
    })()""")


async def select_calendar_date(stagehand, page, selected_date: str) -> None:
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", selected_date):
        raise ValueError("Expected YYYY-MM-DD")
    target = date.fromisoformat(selected_date)
    target_month = target.strftime("%Y-%m")

    async def open_calendar():
        result = await stagehand.act("Open the booking date picker or calendar", page=page)
        if result.data.success is not True:
            raise RuntimeError("Could not open the booking date picker")

    await open_calendar()
    for transition in range(121):
        state = await calendar_state(page)
        months = state.get("months", [])
        if len(months) != 1 or not re.fullmatch(r"\d{4}-\d{2}", months[0]):
            raise RuntimeError("Cannot identify one visible calendar month")
        if months[0] == target_month:
            break
        if transition == 120:
            raise RuntimeError("Requested calendar month was not reached within 120 transitions")
        direction = "next" if months[0] < target_month else "previous"
        button = page.locator(f"button.rdp-button_{direction}")
        if await button.count() != 1 or not await button.is_visible():
            raise RuntimeError("Calendar navigation control is missing or ambiguous")
        await button.click()
        for _ in range(20):
            changed = await calendar_state(page)
            if changed.get("months") != months:
                break
            await page.wait_for_timeout(100)
        else:
            raise RuntimeError("Calendar month did not change after navigation")
    else:
        raise RuntimeError("Requested calendar month was not reached within 120 transitions")

    cell = page.locator(f'[role="gridcell"][data-day="{selected_date}"]:not([data-outside]):not([data-disabled]) button')
    if await cell.count() != 1 or not await cell.is_visible():
        raise RuntimeError("Requested full date is not uniquely available in the calendar")
    await cell.click()
    state = await calendar_state(page)
    if not state.get("months"):
        await open_calendar()
        state = await calendar_state(page)
    if state.get("months") != [target_month] or state.get("selected") != [selected_date]:
        raise RuntimeError("The booking calendar did not confirm the requested full date")
    await page.key_press("Escape")
