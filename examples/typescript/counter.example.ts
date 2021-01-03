import StructuredMessaging from '../../src/index';

let currentMessage = 0;

const logger = new StructuredMessaging({
  transport: [{ type: 'console' }],
  sharedData: {
    count: () => {
      currentMessage += 1;
      return currentMessage;
    },
  },
}).loggers();

logger.info('This is log message number %{count}.');
logger.info('This is log message number %{count}.');
