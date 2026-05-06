import path from 'node:path';
import { fileURLToPath } from 'node:url';

import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express from 'express';

import { connectDB } from './config/db.js';
import { globalErrorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { authRouter } from './transport/http/routes/auth.routes.js';
import { executionRouter } from './transport/http/routes/execution.routes.js';
import { functionRouter } from './transport/http/routes/function.routes.js';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: 'http://localhost:5173', 
    credentials: true, 
  })
);

app.use(express.json());
app.use(cookieParser());

app.use('/auth', authRouter);
app.use('/functions', functionRouter);
app.use('/executions', executionRouter);

app.use(notFoundHandler);
app.use(globalErrorHandler);

try {
  await connectDB();

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Gateway service listening on port ${PORT}`);
  });
} catch (error) {
  // eslint-disable-next-line no-console
  console.error('Failed to start gateway service:', error.message);
  process.exit(1);
}

export { app };
