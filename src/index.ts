/* eslint-disable func-names */
import clone from 'rfdc';
import winston from 'winston';
import StackTracey from 'stacktracey';

import { v4 } from 'uuid';

const { printf } = winston.format;

const SPLAT = Symbol.for('splat');
const deepClone = clone();

/**
 * Default format if no format has been provided for a given logging level (aka:
 * the user uses a new logging level) or no structuredFormat has been provided
 * for the given logging level when creating a StructuredMessaging instance.
 */
const FORMAT_DEFAULT = {
  id: 'calc.id',
  level: 'log.level',
  message: 'log.message',
  topics: 'topics',
  priority: 'calc.priority',
  template: 'log.template',
  transactionId: 'session.transactionId',
  sessionId: 'session.sessionId',
  traceId: 'session.traceId',
  time: {
    format: 'calc.timeFormat',
    created: 'log.timestamp',
    expires: 'expires',
  },
  pii: 'pii',
  dataSchema: 'dataSchema',
  data: 'data',
  context: {
    app: {
      env: 'env.NODE_ENV',
      name: 'env.CONFIG_COMPUTE',
      platform: 'env.CONFIG_PLATFORM',
      file: 'log.context.file',
      line: 'log.context.line',
      column: 'log.context.column',
    },
    compute: {
      processId: 'process.pid',
    },
  },
};

/**
 * Default formats based on log level.
 */
const FORMAT_LEVELS = {
  error: FORMAT_DEFAULT,
  warn: FORMAT_DEFAULT,
  info: FORMAT_DEFAULT,
  http: FORMAT_DEFAULT,
  verbose: FORMAT_DEFAULT,
  debug: FORMAT_DEFAULT,
  silly: FORMAT_DEFAULT,
};

/**
 * StructuredMessaging is an minorly opinionated structured message and
 * structured log formatter.
 */
export default class StructuredMessaging {
  #config: any;

  #logger: winston.Logger;

  /**
   * Given a key that may be scoped via a . (user.name, address.line01, etc.)
   * locate a value within the data object provided. If no key is found in the
   * data or value found, null is returned.
   * @param keys A key that could contain one or more keys split by a . Examples
   *             are user.name or address.line01.
   * @param data Data we are trying to pull a value from.
   */
  private static valueFromHierarchialKey(keys: string | number | boolean, data: any): any {
    const props = typeof keys !== 'string' ? [keys] : keys.split('.');
    let current = data;
    let found = true;
    props.forEach((key) => {
      // forEach doesn't support break; and for ... of syntax seems hokey in this
      // sitution. So, 'escape' forEach logic by assuring found is true.
      if (current !== null && current !== undefined && found) {
        if (Object.prototype.hasOwnProperty.call(current, key)) {
          if (typeof current[key] === 'function') {
            // We want to cache the results of calling the function to assure
            //  that we don't call it more than on time.
            try {
              current[key] = current[key](data);
            } catch (e) {
              // setting the key to undefined will cause the message to
              // still contain the splat.
              current[key] = undefined;
              // TODO FEATURE: Should we replace the current key, log a
              // warning or ???? Hmm.
            }
          }
          current = current[key];
        } else {
          // At some point in the hierarchical key we didn't not find a match.
          // This means we may need to reset found to false.
          found = false;
        }
      } else {
        // Properties with a value of undefined are not serialized. Since no
        // value was found, we want to remove this property from the final
        // serialized object.
        current = undefined;
      }
    });
    return found ? current : undefined;
  }

  /**
   * Takes a message and replaces any spalts with the values located in data.
   * A splat that is not found will be undefined.
   * @param message The initial message that may contain spalts that require
   *    replacement.
   * @param data The data that we can pull from when replacing splats in the
   *    message.
   * @return An object:
   *  message: contains the formatted message.
   *  hadTemplate: true if there were splats in the message, false if there
   *    were no splats.
   */
  private static namedSplat(message: string, data: any): any {
    const namedSplatReg = /a*[%][{]([\S]*)[}]/g;
    let hadTemplate = false;
    let newMessage = message;
    let replacement = namedSplatReg.exec(message);
    while (replacement !== null) {
      hadTemplate = true;
      const replaceStr = replacement[0];
      const currentProp = StructuredMessaging.valueFromHierarchialKey(replacement[1], data);
      if (currentProp !== undefined) {
        // If currentProp is a primitive, then just replace with the raw value.
        if (Object(currentProp) !== currentProp) {
          newMessage = newMessage.replace(replaceStr, currentProp);
        } else {
          // else we will stringify (arrays and objects)
          newMessage = newMessage.replace(replaceStr, JSON.stringify(currentProp));
        }
      } // else we don't format the splat. Don't want to throw any exceptions.
      // TODO FEATURE: Get feedback from users.
      replacement = namedSplatReg.exec(message);
    }
    return {
      hadTemplate,
      message: newMessage,
    };
  }

  /**
   * Given the current 'root' instance of the structure message we are building,
   * along with the current structuredFormat, using values in data, create
   * and return a structured message for the current root. This function is
   * called recursively enabling us to have hierarchical structured messages.
   * @param root The current 'level' of the final structured message we are
   *   building. This enables us to build hierarchical structured messages.
   * @param structuredFormat An object that represents the current structured
   *   format of the final message we are generating. The final message will
   *   have the same structure as this object.
   * @param data The data we are using to pull values from while bilding out
   *   the final structured message.
   *
   * @returns The formatted structured message.
   */
  private buildMessage(root: any, structuredFormat: any, data: any): any {
    Object.keys(structuredFormat).forEach((key: string) => {
      const keyValue = structuredFormat[key];
      if (
        typeof keyValue === 'string' ||
        typeof keyValue === 'number' ||
        typeof keyValue === 'boolean'
      ) {
        /* eslint-disable no-param-reassign */
        const result = StructuredMessaging.valueFromHierarchialKey(keyValue, data);
        if (result !== undefined) {
          // Is this a primitive?
          if (Object(result) !== result || Array.isArray(result)) {
            root[key] = result;
          } else if (Object.entries(result).length !== 0) {
            root[key] = result;
          } // else we do not want to set the value
        } // else we do not wan't to set the value.
      } else if (typeof keyValue === 'object') {
        /* eslint-disable no-param-reassign */
        root[key] = {};
        this.buildMessage(root[key], structuredFormat[key], data);

        // Don't keep around any empty objects: no noisy logs.
        // TODO FEATURE: May want to make this optional in some way? Maybe
        // some people who log would like to see empty objects?
        if (Object.entries(root[key]).length === 0) {
          delete root[key];
        }
      } // else ignore any other types of objects or a null key value.
    });

    return root;
  }

  /**
   * Creates an instance of a StructuredMessaging object.
   * @param config Used to configure the winston logger. Winston specific config
   * values are forwarded to winston's createLogger method. Other config values
   * may be used internally.
   */
  constructor(config: any = {}) {
    this.#config = config;

    /**
     * We should always try to have at least one transport or winston will
     * error out. So, we provide a default console transport if none are
     * defined. The user can provide an empty tranport array if they don't want
     * a defaul to be defined.
     */

    if (!config.transports && !config.transport) {
      config.transport = [{ type: 'console' }];
    }

    if (config.transport) {
      if (!config.transports) {
        config.transports = [];
      }

      config.transport.forEach((item) => {
        switch (item.type) {
          case 'console':
            config.transports.push(new winston.transports.Console(item.options));
            break;
          case 'file':
            config.transports.push(new winston.transports.File(item.options));
            break;
          default:
          // do nothing
        }
      });
    }

    /**
     * Implementation of winston printf callback
     */
    const customFormat = printf((logMessage: any) => {
      // logMessage changes based on how winston.log is called.
      // 1) message, data, 2) Error 3) message, Error, data 4) message, data, Error
      const splat = logMessage[SPLAT];
      let error = logMessage instanceof Error ? logMessage : undefined;
      let splatData;
      if (splat) {
        if (splat[0] instanceof Error) {
          [error, splatData] = splat;
        } else if (splat[1] instanceof Error) {
          [splatData, error] = splat;
          // When calling logging.log(Error) or logging.log(msg, Error)
          // winston appends the error.message to the message string.
          // Doing the same here to simulate behavior.
          logMessage.message = `${logMessage.message} ${error.message}`;
        } else {
          [splatData] = splat;
        }
      }

      // Splat and custom data may be altered during logging because we resolve
      // functions (so they don't get called more than once): updating the
      // original message with a resolved value.
      const data = {
        calc: {
          id: v4,
          priority: 1,
          timeFormat: 'iso8061',
        },
        topics: ['log'],
        log: {
          ...logMessage,
          context: error ? new StackTracey(error.stack).items[0] : undefined,
        },
        ...deepClone(splatData),
        ...deepClone(config.sharedData),
      };
      const { hadTemplate, message } = StructuredMessaging.namedSplat(logMessage.message, data);
      if (hadTemplate) {
        data.log.template = logMessage.message;
        data.log.message = message;
      }

      const structuredFormat = this.#config.structured
        ? this.#config.structured[logMessage.level] || FORMAT_LEVELS[logMessage.level]
        : FORMAT_LEVELS[logMessage.level];

      let result = {};
      result = this.buildMessage(result, structuredFormat, data);
      return JSON.stringify(result);
    });

    this.#config.format = winston.format.combine(
      winston.format.timestamp({ format: 'isoDateTime' }),
      customFormat,
    );
  }

  /**
   * Creates and returns a winston logger instance.
   *
   * @Returns A new winston logger instance.
   *  */
  public loggers(): winston.Logger {
    if (!this.#logger) {
      this.#logger = winston.createLogger(this.#config);
    }

    return this.#logger;
  }
}
