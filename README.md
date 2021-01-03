# structured-messaging

NOTE: In Beta.

[![GitHub license](https://img.shields.io/github/license/erichosick/structured-messaging?style=flat)](https://github.com/erichosick/structured-messaging/blob/main/LICENSE) ![npm](https://img.shields.io/npm/v/@ehosick/structured-messaging) [![codecov](https://codecov.io/gh/erichosick/structured-messaging/branch/main/graph/badge.svg)](https://codecov.io/gh/erichosick/structured-messaging)

Fully configurable structured messaging and logging tool wrapping [Winston](https://github.com/winstonjs/winston). Recommended to be used in conjunction with [config-core](https://github.com/erichosick/config-core).

# Motivation

Quickly get up and running with structured logging/messaging without being too opinionated.

We highly suggest using this library in conjunction with [config-core](https://github.com/erichosick/config-core).

# Quick Start

Checkout the [typescript examples](./examples/typescript/README.md).

## Usage

```typescript
import StructuredMessaging from 'structured-messaging';

let currentMessage = 0;

const logger = new StructuredMessaging(
  // use any winston parameters
  // see (https://github.com/winstonjs/winston#creating-your-own-logger)
  {
    level: 'info',
    // configure transports
    transport: [
      { type: 'console' },
      {
        type: 'file',
        // use any winston transport options for the given transport
        options: { filename: 'error_01.log', level: 'error' },
      },
    ],
    sharedData: {
      count: () => {
        currentMessage += 1;
        return currentMessage;
      },
    },
  },
).loggers();

logger.info('This is log message number %{count}.');
logger.info('This is log message number %{count}.');

// setup the logger
```
