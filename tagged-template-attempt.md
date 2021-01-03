- Tagged Template Attempt

We attempted to use winston via a tagged template as the message but that currently isn't supported by winston.

Example usage:

```typescript
// Let's create our tagged template
// see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals
function template(strings, ...keys) {
  return function (...values) {
    const dict = values[values.length - 1] || {};
    const result = [strings[0]];
    keys.forEach((key, i) => {
      const value = Number.isInteger(key) ? values[key] : dict[key];
      result.push(value, strings[i + 1]);
    });
    return result.join('');
  };
}

// We implement custom formatting using printf

const taggedFormat = printf((logMsg) => {
  const result = {
    level: logMsg.level,
    // We execute the tagged template literal passing the logMsg which
    // contains any data that will be used by the tagged templae literal
    message: logMsg.message(logMsg),
  };
  return JSON.stringify(result);
});

// create an instance of winston using our custom format

const logger = winston.create({
  level: 'info',
  format: winston.format.combine(taggedFormat),
});

// We could then log using tagged templates

logger.info(template`I'm ${'name'}. I'm almost ${'age'} years old.`, {
  name: 'Teddy',
  age: 43,
});
```

which outputs: `I'm Teddy. I'm almost 43 years old.`

However, the interface for logger.log (info, error, etc.) requires the first parameter to be a string. As such, we are unable to use tagged template literals with winston (at this time).
