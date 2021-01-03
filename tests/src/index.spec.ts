import chai from 'chai';
import fs from 'fs';
import winston from 'winston';
import { version as uuidVersion } from 'uuid';
import nanoid from 'nanoid';

import InMemoryStream from '../in-memory-stream';
import StructuredMessaging from '../../src/index';

const { expect } = chai;

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

describe('structured logging', () => {
  describe('library', () => {
    it('should expose library correctly', () => {
      expect(StructuredMessaging, 'should be a function').to.be.a('function');
    });
  });

  describe('log level', () => {
    it('should log only when message log level is enabled', () => {
      const memoryStream = new InMemoryStream();

      const logger = new StructuredMessaging({
        level: 'error',
        transports: [new winston.transports.Stream({ stream: memoryStream })],
      }).loggers();

      logger.error('This will be logged');
      logger.info('But this will not be logged');

      const logged = memoryStream.readAsObject();

      expect(logged.length, 'only one message should be logged').to.equal(1);
      expect(logged[0].message, 'should be correct message').to.equal('This will be logged');
    });
  });

  describe('logger creation', () => {
    it('should only create an instance one time', () => {
      const memoryStream = new InMemoryStream();

      const structuredMessage = new StructuredMessaging({
        level: 'error',
        transports: [new winston.transports.Stream({ stream: memoryStream })],
      });

      const logger01 = structuredMessage.loggers();
      const logger02 = structuredMessage.loggers();

      expect(logger01, 'should be same instance').to.equal(logger02);
    });
  });

  describe('structured message format', () => {
    it(`should format default correctly when missing meta-data
       such as context, etc.
       1) Any property that is undefined will not be serialized.
       2) Any object that is empty will not be serialized.`, () => {
      const memoryStream = new InMemoryStream();

      const logger = new StructuredMessaging({
        level: 'info',
        transports: [new winston.transports.Stream({ stream: memoryStream })],
      }).loggers();

      logger.info('This is a basic info message.');

      const first = memoryStream.readAsObject()[0];
      expect(first).to.deep.equal({
        id: first.id,
        level: 'info',
        message: 'This is a basic info message.',
        topics: ['log'],
        priority: 1,
        time: { format: 'iso8061', created: first.time.created },
      });
      expect(first, 'No template property when message has not "splats"').to.not.have.property(
        'template',
      );
    });

    it(`should use default "info" structured message format
      and support "splats"`, () => {
      const memoryStream = new InMemoryStream();

      const logger = new StructuredMessaging({
        level: 'info',
        transports: [new winston.transports.Stream({ stream: memoryStream })],
        sharedData: {
          env: {
            CONFIG_PLATFORM: 'goldenCRM',
            CONFIG_COMPUTE: 'userAPI',
            NODE_ENV: 'dev',
          },
          session: {
            sessionId: 'aba3b8fe-2c8b-48fe-8249-390f46ed4eec',
            transactionId: '8bc1978e-e8f7-44f8-90e4-6f43e9fb45cf',
            traceId: '737b9ece-3535-4d2d-8748-84ea971b5385',
          },
          process: {
            pid: process.pid,
          },
        },
      }).loggers();

      logger.info('Running SQL for %{data.name}: %{data.query}.', {
        expires: '2020-12-20T09:00:34+07:00',
        dataSchema: {
          name: 'sql',
          ver: '1.0.0',
        },
        pii: ['data.name'],
        data: {
          query: 'SELECT * FROM types;',
          name: 'Alan',
        },
      });

      const first = memoryStream.readAsObject()[0];
      expect(first).to.deep.equal({
        id: first.id,
        level: 'info',
        message: 'Running SQL for Alan: SELECT * FROM types;.',
        topics: ['log'],
        priority: 1,
        template: 'Running SQL for %{data.name}: %{data.query}.',
        transactionId: '8bc1978e-e8f7-44f8-90e4-6f43e9fb45cf',
        sessionId: 'aba3b8fe-2c8b-48fe-8249-390f46ed4eec',
        traceId: '737b9ece-3535-4d2d-8748-84ea971b5385',
        time: {
          format: 'iso8061',
          created: first.time.created,
          expires: '2020-12-20T09:00:34+07:00',
        },
        dataSchema: {
          name: 'sql',
          ver: '1.0.0',
        },
        pii: ['data.name'],
        data: {
          query: 'SELECT * FROM types;',
          name: 'Alan',
        },
        context: {
          app: {
            env: 'dev',
            name: 'userAPI',
            platform: 'goldenCRM',
          },
          compute: {
            processId: process.pid,
          },
        },
      });

      expect(uuidVersion(first.id), 'should be a v4 by default').to.equal(4);
      expect(first.time.expires, 'should be a time with ISO_8601 format').to.match(
        /(\d{4})-(\d{2})-(\d{2})T(\d{2})\:(\d{2})\:(\d{2})[+-](\d{2})\:(\d{2})/,
      );
    });

    it('should use default "warn" structured message format', () => {
      const memoryStream = new InMemoryStream();

      const logger = new StructuredMessaging({
        level: 'info',
        transports: [new winston.transports.Stream({ stream: memoryStream })],
      }).loggers();

      logger.warn('Level is %{log.level}');

      const first = memoryStream.readAsObject()[0];
      expect(first.message).to.equal('Level is warn');
    });

    it('should use default "http" structured message format', () => {
      const memoryStream = new InMemoryStream();

      const logger = new StructuredMessaging({
        level: 'http',
        transports: [new winston.transports.Stream({ stream: memoryStream })],
      }).loggers();

      logger.http('Level is %{log.level}');

      const first = memoryStream.readAsObject()[0];
      expect(first.message).to.equal('Level is http');
    });

    it('should use default "verbose" structured message format', () => {
      const memoryStream = new InMemoryStream();

      const logger = new StructuredMessaging({
        level: 'verbose',
        transports: [new winston.transports.Stream({ stream: memoryStream })],
      }).loggers();

      logger.verbose('Level is %{log.level}');

      const first = memoryStream.readAsObject()[0];
      expect(first.message).to.equal('Level is verbose');
    });

    it('should use default "debug" structured message format', () => {
      const memoryStream = new InMemoryStream();

      const logger = new StructuredMessaging({
        level: 'debug',
        transports: [new winston.transports.Stream({ stream: memoryStream })],
      }).loggers();

      logger.debug('Level is %{log.level}');

      const first = memoryStream.readAsObject()[0];
      expect(first.message).to.equal('Level is debug');
    });

    it('should use default "silly" structured message format', () => {
      const memoryStream = new InMemoryStream();

      const logger = new StructuredMessaging({
        level: 'silly',
        transports: [new winston.transports.Stream({ stream: memoryStream })],
      }).loggers();

      logger.silly('Level is %{log.level}');

      const first = memoryStream.readAsObject()[0];
      expect(first.message).to.equal('Level is silly');
    });

    it('should allow different structured messages based on log level', () => {
      const memoryStream = new InMemoryStream();
      const logger = new StructuredMessaging({
        level: 'silly',
        transports: [new winston.transports.Stream({ stream: memoryStream })],
        structured: {
          error: {
            error_msg: 'log.message',
          },
          warn: {
            warn_msg: 'log.message',
          },
          info: {
            info_msg: 'log.message',
          },
          http: {
            http_msg: 'log.message',
          },
          verbose: {
            verbose_msg: 'log.message',
          },
          debug: {
            debug_msg: 'log.message',
          },
          silly: {
            silly_msg: 'log.message',
          },
        },
      }).loggers();

      logger.error('error');
      logger.warn('warn');
      logger.info('info');
      logger.http('http');
      logger.verbose('verbose');
      logger.debug('debug');
      logger.silly('silly');

      const messages = memoryStream.readAsObject();
      expect(messages[0].error_msg).to.equal('error');
      expect(messages[1].warn_msg).to.equal('warn');
      expect(messages[2].info_msg).to.equal('info');
      expect(messages[3].http_msg).to.equal('http');
      expect(messages[4].verbose_msg).to.equal('verbose');
      expect(messages[5].debug_msg).to.equal('debug');
      expect(messages[6].silly_msg).to.equal('silly');
    });

    xit('should support directly logging an error', () => {
      const memoryStream = new InMemoryStream();

      const logger = new StructuredMessaging({
        level: 'info',
        transports: [new winston.transports.Stream({ stream: memoryStream })],
        sharedData: {
          session: {
            sessionId: 'aba3b8fe-2c8b-48fe-8249-390f46ed4eec',
          },
        },
      }).loggers();

      // NOTE: Winston does not support additional parameters when logging
      // an error directly. So, we won't be able to provide any additional
      // data.
      logger.error(new Error('A Test Error with level %{log.level}'));

      const first = memoryStream.readAsObject()[0];

      // NOTE: Cases where we populate test case from test source are
      //       covered in other tests.
      expect(first).to.deep.equal({
        id: first.id,
        level: 'error',
        message: 'A Test Error with level error',
        template: 'A Test Error with level %{log.level}',
        topics: ['log'],
        priority: 1,
        sessionId: 'aba3b8fe-2c8b-48fe-8249-390f46ed4eec',
        time: { format: 'iso8061', created: first.time.created },
        context: {
          app: {
            file: first.context.app.file,
            line: first.context.app.line,
            column: first.context.app.column,
          },
        },
      });

      expect(first.context.app.file).to.contain('structured-messaging/tests/src/index.spec.ts');
      expect(first.context.app.line).to.be.a('number');
      expect(first.context.app.column).to.be.a('number');
    });

    xit('should support logging an error along with a message and additional context', () => {
      const memoryStream = new InMemoryStream();

      const logger = new StructuredMessaging({
        level: 'info',
        transports: [new winston.transports.Stream({ stream: memoryStream })],
        sharedData: {
          session: {
            sessionId: 'aba3b8fe-2c8b-48fe-8249-390f46ed4eec',
          },
        },
      }).loggers();

      // NOTE: Winston automatically appends the error text to the message
      // when the error is the 2nd parameter.
      logger.error(
        'Had an error with data %{errorType}:',
        new Error('A %{errorType} error with level %{log.level}'),
        {
          errorType: 'Good',
        },
      );

      const first = memoryStream.readAsObject()[0];
      expect(first).to.deep.equal({
        id: first.id,
        level: 'error',
        message: 'Had an error with data Good: A Good error with level error',
        topics: ['log'],
        priority: 1,
        template:
          'Had an error with data %{errorType}: A %{errorType} error with level %{log.level}',
        sessionId: 'aba3b8fe-2c8b-48fe-8249-390f46ed4eec',
        time: { format: 'iso8061', created: first.time.created },
        context: {
          app: {
            file: first.context.app.file,
            line: first.context.app.line,
            column: first.context.app.column,
          },
        },
      });

      expect(first.context.app.file).to.contain('structured-messaging/tests/src/index.spec.ts');
      expect(first.context.app.line).to.be.a('number');
      expect(first.context.app.column).to.be.a('number');
    });

    xit('should support logging additional data along with an error message', () => {
      const memoryStream = new InMemoryStream();

      const logger = new StructuredMessaging({
        level: 'info',
        transports: [new winston.transports.Stream({ stream: memoryStream })],
        sharedData: {
          session: {
            sessionId: 'aba3b8fe-2c8b-48fe-8249-390f46ed4eec',
          },
        },
      }).loggers();

      // NOTE: Winston automatically appends the error text to the message
      // when the error is the 2nd parameter.
      logger.error(
        'Had an error with data %{errorType}:',
        {
          errorType: 'Good',
        },
        new Error('A %{errorType} error with level %{log.level}'),
      );

      const first = memoryStream.readAsObject()[0];

      expect(first).to.deep.equal({
        id: first.id,
        level: 'error',
        message: 'Had an error with data Good: A Good error with level error',
        topics: ['log'],
        priority: 1,
        template:
          'Had an error with data %{errorType}: A %{errorType} error with level %{log.level}',
        sessionId: 'aba3b8fe-2c8b-48fe-8249-390f46ed4eec',
        time: { format: 'iso8061', created: first.time.created },
        context: {
          app: {
            file: first.context.app.file,
            line: first.context.app.line,
            column: first.context.app.column,
          },
        },
      });

      expect(first.context.app.file).to.contain('structured-messaging/tests/src/index.spec.ts');
      expect(first.context.app.line).to.be.a('number');
      expect(first.context.app.column).to.be.a('number');
    });

    it('should respect the order as defined by the structured format', () => {
      const memoryStreamA = new InMemoryStream();

      const loggerA = new StructuredMessaging({
        level: 'info',
        transports: [new winston.transports.Stream({ stream: memoryStreamA })],
        structured: {
          info: {
            level: 'log.level',
            message: 'log.message',
          },
        },
      }).loggers();

      const memoryStreamB = new InMemoryStream();

      const loggerB = new StructuredMessaging({
        level: 'info',
        transports: [new winston.transports.Stream({ stream: memoryStreamB })],
        structured: {
          info: {
            message: 'log.message',
            level: 'log.level',
          },
        },
      }).loggers();

      loggerA.info('This is an info message.');
      loggerB.info('This is an info message.');

      expect(memoryStreamA.readAsString()).to.equal(
        '{"level":"info","message":"This is an info message."}\n',
      );
      expect(memoryStreamB.readAsString()).to.equal(
        '{"message":"This is an info message.","level":"info"}\n',
      );
    });
  });

  describe('message incrementors and unique ids', () => {
    it('should support generating UUIDs and counts and format appropriately', () => {
      const memoryStream = new InMemoryStream();
      let currentMessage = 0;

      const logger = new StructuredMessaging({
        level: 'info',
        transports: [new winston.transports.Stream({ stream: memoryStream })],
        sharedData: {
          count: () => {
            currentMessage += 1;
            return currentMessage;
          },
        },
      }).loggers();

      logger.info('The unique id of this %{count}st log is %{calc.id}.');
      logger.info('The unique id of this %{count}nd log is %{calc.id}.');

      const first = memoryStream.readAsObject()[0];
      const second = memoryStream.readAsObject()[1];
      expect(first.id, 'should change between each logged message').to.not.equal(second.id);
      expect(first.message, 'should format correctly as 1st').to.equal(
        `The unique id of this 1st log is ${first.id}.`,
      );
      expect(second.message, 'should format correctly as 2nd').to.equal(
        `The unique id of this 2nd log is ${second.id}.`,
      );
    });

    it('should support custom UUIDs: overriding default uuid v4', () => {
      const memoryStream = new InMemoryStream();

      const logger = new StructuredMessaging({
        level: 'info',
        transports: [new winston.transports.Stream({ stream: memoryStream })],
        sharedData: {
          calc: {
            id: nanoid.urlAlphabet,
          },
        },
      }).loggers();

      logger.info('The unique id of this, %{calc.id}, is a custom unique id');

      const first = memoryStream.readAsObject()[0];
      expect(first.id).to.contain('ModuleSymbhasOwnPr-');
    });
  });

  // TODO: all splats verify undefined splats
  // TODO: test for a custom function that throws an exception.
  describe('message splats', () => {
    it(`should still have spalt definitions in
      message if undefined was found for the value`, () => {
      const memoryStream = new InMemoryStream();

      const logger = new StructuredMessaging({
        level: 'info',
        transports: [new winston.transports.Stream({ stream: memoryStream })],
      }).loggers();

      logger.info('Data is %{no.value} and %{novalue} but %{nullValue} is null.', {
        nullValue: null,
      });

      const first = memoryStream.readAsObject()[0];
      expect(first.template).to.equal(
        'Data is %{no.value} and %{novalue} but %{nullValue} is null.',
      );
      expect(first.message).to.equal('Data is %{no.value} and %{novalue} but null is null.');
    });

    it(`should spalt message and template without
      going into and infinite loop.`, () => {
      const memoryStream = new InMemoryStream();

      const logger = new StructuredMessaging({
        level: 'info',
        transports: [new winston.transports.Stream({ stream: memoryStream })],
      }).loggers();

      logger.info('Both of these are not resolved %{log.message} and %{log.template}', {
        nullValue: null,
      });

      const first = memoryStream.readAsObject()[0];
      expect(first.template).to.equal(
        'Both of these are not resolved %{log.message} and %{log.template}',
      );
      expect(first.message).to.equal(
        'Both of these are not resolved Both of these are not resolved %{log.message} and %{log.template} and %{log.template}',
      );
    });

    it(`should support accessing all types of data:
       1) boolean, number, array, object, string`, () => {
      const memoryStream = new InMemoryStream();

      const logger = new StructuredMessaging({
        level: 'info',
        transports: [new winston.transports.Stream({ stream: memoryStream })],
        sharedData: {
          env: {
            CONFIG_PLATFORM: 'goldenCRM',
            CONFIG_COMPUTE: 'userAPI',
            NODE_ENV: 'dev',
          },
          session: {
            sessionId: 'aba3b8fe-2c8b-48fe-8249-390f46ed4eec',
            transactionId: '8bc1978e-e8f7-44f8-90e4-6f43e9fb45cf',
            traceId: '737b9ece-3535-4d2d-8748-84ea971b5385',
          },
          process: {
            pid: process.pid,
          },
        },
      }).loggers();

      logger.info(
        'level: %{log.level}, topics: %{topics}, priority %{calc.priority}, time.format: %{calc.timeFormat}, time.expires: %{expires}, pii: %{pii}, data: %{data}, number: %{number}',
        {
          expires: '2020-12-20T09:00:34+07:00',
          topics: ['log', 'info'],
          dataSchema: {
            name: 'sql',
            ver: '1.0.0',
          },
          pii: ['data.name'],
          number: 5,
          data: {
            query: 'SELECT * FROM types;',
            name: 'Alan',
          },
        },
      );

      const first = memoryStream.readAsObject()[0];
      expect(first.message).to.equal(
        'level: info, topics: ["log","info"], priority 1, time.format: iso8061, time.expires: 2020-12-20T09:00:34+07:00, pii: ["data.name"], data: {"query":"SELECT * FROM types;","name":"Alan"}, number: 5',
      );
    });
  });

  describe('custom structured message format and splat', () => {
    it(`should support custom structured formats defined
      throught the structuredFormat property:
      1) support constants of type string, array, boolean, null.
      2) support resolving functions
      3) support accessing a property of a function
      4) ignore empty default objects`, () => {
      const memoryStream = new InMemoryStream();
      const logger = new StructuredMessaging({
        level: 'info',
        transports: [new winston.transports.Stream({ stream: memoryStream })],
        structured: {
          info: {
            id: 'calc.id',
            tm: {
              type: 'typeConstant',
              exp: 'expires',
            },
            8: 8,
            false: false,
            5: 5,
            nullRoot: 'nullRoot',
            edges: {
              true: 'edgeCases.true',
              emptyObj: 'emptyObject', // should not be logged.
              noSuchProp: 'edgeCases.noSuchProperty', // should not be logged
              undefProp: 'edgeCases.undefinedValue', // should not be logged
              nullValue: 'edgeCases.nullValue',
              trueValue: 'edgeCases.trueValue',
              falseValue: 'edgeCases.falseValue',
              arrValue: 'edgeCases.arrValue',
              funcOne: 'edgeCases.func01Value',
              funcTwo: 'edgeCases.func02Value.value02',
              5: 'edgeCases.5',
            },
          },
        },
      }).loggers();
      logger.info('This is an info message.', {
        expires: '2020-12-20T09:00:34+07:00',
        typeConstant: 'iso8061',
        emptyObject: {},
        8: 8,
        false: false,
        5: 'five',
        nullRoot: null,
        edgeCases: {
          true: true,
          5: 'five',
          nullValue: null,
          undefinedValue: undefined,
          trueValue: true,
          falseValue: false,
          arrValue: ['1', 2, { an: 'obj' }],
          func01Value: () => 'Function one',
          func02Value: () => ({ value01: 'one', value02: 'two' }),
          embeded: {},
        },
      });
      const first = memoryStream.readAsObject()[0];
      expect(first).to.deep.equal({
        id: first.id,
        tm: { type: 'iso8061', exp: '2020-12-20T09:00:34+07:00' },
        8: 8,
        false: false,
        5: 'five',
        nullRoot: null,
        edges: {
          true: true,
          nullValue: null,
          trueValue: true,
          falseValue: false,
          arrValue: ['1', 2, { an: 'obj' }],
          funcOne: 'Function one',
          funcTwo: 'two',
          5: 'five',
        },
      });
    });
  });

  describe('never throw errors', () => {
    it('should never throw an exception when running user defined function', () => {
      const memoryStream = new InMemoryStream();

      const logger = new StructuredMessaging({
        level: 'info',
        transports: [new winston.transports.Stream({ stream: memoryStream })],
        sharedData: {
          willException: () => {
            throw new Error('What do we do?');
          },
        },
      }).loggers();

      logger.info('This message %{willException}');
      const first = memoryStream.readAsObject()[0];
      expect(first.message, 'An exception will result in not replacing the splat').to.equal(
        'This message %{willException}',
      );
    });
  });

  describe('configure transports', () => {
    it(`should support creation of console transport and
       not overwrite any coded transports`, () => {
      const memoryStream = new InMemoryStream();

      const logger = new StructuredMessaging({
        level: 'info',
        transports: [new winston.transports.Stream({ stream: memoryStream })],
        transport: [
          {
            type: 'console',
            options: { eol: '\n', stderrLevels: ['error'] },
          },
        ],
      }).loggers();

      logger.info('Will show up during testing...');
      const first = memoryStream.readAsObject()[0];
      expect(first).to.not.be.undefined;
    });

    it(`should support creation of console transport while
       no other coded transports were provided by the transports property`, () => {
      const logger = new StructuredMessaging({
        level: 'info',
        transport: [
          {
            type: 'console',
            options: { eol: '\n', stderrLevels: ['error'] },
          },
        ],
      }).loggers();

      logger.info('Will show up during testing...');
    });

    it(`should support creation of a file transport
      and ignore transports that aren't recognized`, async () => {
      const fullFileName = 'test_01.log';
      // Cleanup just in case prior test was unable to clean up file
      try {
        fs.unlinkSync(fullFileName);
      } catch (err) {
        // do nothing
      }

      const logger = new StructuredMessaging({
        level: 'info',
        transport: [
          {
            type: 'file',
            options: { filename: 'test_01.log', level: 'error' },
          },
          {
            type: 'ignore',
            options: { not: 'valid' },
          },
        ],
      }).loggers();

      logger.error('Should show up in a log file.');

      // Give the logger sometime to write to the file
      await sleep(100);
      const data = fs.readFileSync(fullFileName, { encoding: 'utf8', flag: 'r' });
      expect(data).to.contain('Should show up in a log file.');

      // Cleanup test
      try {
        fs.unlinkSync(fullFileName);
      } catch (err) {
        // do nothing
      }
    });

    it(`should create a console transport if no transport
        is provided in settings.`, () => {
      const logger = new StructuredMessaging().loggers();

      logger.info('Created a console transport. Will show up during testing...');
    });
  });
});
