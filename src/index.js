const { launchBrowser } = require('./browser');
const { runLogin } = require('./login');
const logger = require('./logger');

(async () => {
  const forceNew = process.argv.includes('--fresh');
  const stay = process.argv.includes('--stay');

  const { browser, page } = await launchBrowser();
  try {
    const result = await runLogin(page, { forceNew });
    logger.info(`DONE: ${JSON.stringify(result)}`);
    if (stay) {
      logger.info('Staying open for 60s for manual inspection (--stay)...');
      await new Promise((resolve) => setTimeout(resolve, 60000));
    }
  } catch (err) {
    logger.error(err.message);
    process.exitCode = 1;
  } finally {
    await browser.close().catch(() => {});
  }
})();
