const XPATH_PREFIX = 'xpath:';

/**
 * Finds the first element matching any of the candidate selectors.
 * Supports CSS selectors and XPath expressions prefixed with "xpath:".
 * Returns an ElementHandle or null.
 */
async function queryFirst(page, selectors) {
  for (const sel of selectors || []) {
    try {
      if (sel.startsWith(XPATH_PREFIX)) {
        const expression = sel.slice(XPATH_PREFIX.length);
        const handle = await page.evaluateHandle((xp) => {
          const result = document.evaluate(
            xp,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          return result.singleNodeValue;
        }, expression);
        const el = handle.asElement();
        if (el) return el;
        await handle.dispose();
      } else {
        const el = await page.$(sel);
        if (el) return el;
      }
    } catch {
      // invalid selector or page navigating — try the next candidate
    }
  }
  return null;
}

/**
 * Polls the page until one of the candidate selectors matches,
 * or the timeout is reached. Returns an ElementHandle or null.
 */
async function waitForFirst(page, selectors, { timeout = 15000, pollMs = 250 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const el = await queryFirst(page, selectors);
    if (el) return el;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return null;
}

/**
 * Checks whether an element is actually visible on the page.
 */
async function isVisible(el) {
  return el.evaluate((e) => {
    if (!e) return false;
    const rect = e.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const style = window.getComputedStyle(e);
    return style.visibility !== 'hidden' && style.display !== 'none';
  });
}

module.exports = { queryFirst, waitForFirst, isVisible };
