import { sendError } from '../utils/http/response.util.js';

function validate(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return sendError(res, {
        statusCode: 400,
        message: 'Validation failed',
        errorCode: 'VALIDATION_ERROR',
        details: error.details.map((item) => item.message),
      });
    }

    req[property] = value;
    return next();
  };
}

export { validate };
