import Joi from 'joi';

const functionIdParam = Joi.object({
  id: Joi.string().required(),
});

const createFunctionBody = Joi.object({
  name: Joi.string().trim().required(),
  language: Joi.string().valid('python', 'node', 'go').required(),
});

export { functionIdParam, createFunctionBody };
