import { config, FileSource } from '@ehosick/config-core';
import StructuredMessaging from '../../src/index';

(async () => {
  const preConfigLog = new StructuredMessaging({}).loggers();
  try {
    await config.addSource(new FileSource(`${__dirname}/full-config-dta.ts`));

    const logger = new StructuredMessaging({
      ...config.get('logging'),
      sharedData: { env: config.get('_env') },
    }).loggers();

    logger.info('Successfully setup logging for the %{env.NODE_ENV} environment.');
  } catch (err) {
    console.log(err);
    preConfigLog.error(err);
  }
})();
