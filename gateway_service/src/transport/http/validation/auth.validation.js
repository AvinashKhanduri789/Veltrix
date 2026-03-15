import Joi from 'joi';

const registerBody = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid('USER', 'ADMIN').optional(),
});

const loginBody = Joi.object({
  email: Joi.string().required(),
  password: Joi.string().required(),
});

export { registerBody, loginBody };
