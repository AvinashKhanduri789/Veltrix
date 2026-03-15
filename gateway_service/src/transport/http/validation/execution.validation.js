import Joi from 'joi';

const functionIdParam = Joi.object({
  functionId: Joi.string().required(),
});

const executionIdParam = Joi.object({
  executionId: Joi.string().required(),
});

const triggerExecutionBody = Joi.object({
  inputPayload: Joi.object().optional(),
});

export { functionIdParam, executionIdParam, triggerExecutionBody };
