import { Router } from 'express';

import { jwtAuth } from '../../../middleware/jwt.middleware.js';
import { validate } from '../../../middleware/validation.middleware.js';
import {
  cancelExecution,
  getExecution,
  getExecutionsByFunction,
  replayExecution,
  streamExecutionLogs,
  triggerExecution,
} from '../controllers/execution.controller.js';
import {
  executionIdParam,
  functionIdParam,
  triggerExecutionBody,
} from '../validation/execution.validation.js';

const executionRouter = Router();

executionRouter.post('/:functionId', jwtAuth, validate(functionIdParam, 'params'), validate(triggerExecutionBody), triggerExecution);
executionRouter.post('/:executionId/replay', jwtAuth, validate(executionIdParam, 'params'), replayExecution);
executionRouter.post('/:executionId/cancel', jwtAuth, validate(executionIdParam, 'params'), cancelExecution);
executionRouter.get('/:executionId', jwtAuth, validate(executionIdParam, 'params'), getExecution);
executionRouter.get('/function/:functionId', jwtAuth, validate(functionIdParam, 'params'), getExecutionsByFunction);
executionRouter.get('/:executionId/logs', jwtAuth, validate(executionIdParam, 'params'), streamExecutionLogs);

export { executionRouter };
