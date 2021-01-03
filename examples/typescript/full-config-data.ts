let currentMessage = 0;

export default {
  _env: {
    CONFIG_PLATFORM: 'examples',
    CONFIG_COMPUTE: 'test',
    NODE_ENV: 'dev',
  },
  _shared: {
    _shared: {
      _shared: {
        logging: {
          transport: [{ type: 'console' }],
          sharedData: {
            count: () => {
              currentMessage += 1;
              return currentMessage;
            },
          },
        },
      },
    },
  },
};
