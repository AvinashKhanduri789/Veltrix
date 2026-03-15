import { Router } from 'express';

import { jwtAuth } from '../../../middleware/jwt.middleware.js';
import { validate } from '../../../middleware/validation.middleware.js';
import { getCurrentUser, login, register } from '../controllers/auth.controller.js';
import { loginBody, registerBody } from '../validation/auth.validation.js';

const authRouter = Router();

authRouter.post('/register', validate(registerBody), register);
authRouter.post('/login', validate(loginBody), login);
authRouter.get('/me', jwtAuth, getCurrentUser);

export { authRouter };
