import { Router } from 'express';

import { jwtAuth } from '../../../middleware/jwt.middleware.js';
import { uploadFunctionSource } from '../../../middleware/upload.middleware.js';
import { validate } from '../../../middleware/validation.middleware.js';
import {
  createFunction,
  deleteFunction,
  getFunctionById,
  getFunctions,
  updateFunction,
} from '../controllers/function.controller.js';
import {
  createFunctionBody,
  functionIdParam,
} from '../validation/function.validation.js';

const functionRouter = Router();

functionRouter.post('/', jwtAuth, uploadFunctionSource, validate(createFunctionBody), createFunction);
functionRouter.put('/:id', jwtAuth, validate(functionIdParam, 'params'), uploadFunctionSource, updateFunction);
functionRouter.get('/', jwtAuth, getFunctions);
functionRouter.get('/:id', jwtAuth, validate(functionIdParam, 'params'), getFunctionById);
functionRouter.delete('/:id', jwtAuth, validate(functionIdParam, 'params'), deleteFunction);

export { functionRouter };
