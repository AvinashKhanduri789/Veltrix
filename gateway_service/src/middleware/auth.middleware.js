import { jwtAuth } from './jwt.middleware.js';

const requireAuth = jwtAuth;

export { jwtAuth, requireAuth };
