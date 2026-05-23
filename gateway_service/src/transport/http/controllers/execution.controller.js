import mongoose from 'mongoose';

import Execution from '../../../models/Execution.js';
import Function from '../../../models/Function.js';
import FunctionVersion from '../../../models/FunctionVersion.js';
import { sendError, sendSuccess } from '../../../utils/http/response.util.js';
import { getPresignedCodeUrl } from '../../../utils/storage/minio.util.js';
import logsClient from '../../grpc/logs.client.js';
import schedulerClient from '../../grpc/scheduler.client.js';

const activeExecutionLogStreams = new Map();
const DEMO_EXECUTION_DISABLED_MESSAGE = 'Execution infrastructure is disabled in the public demo deployment.';

function isDemoModeEnabled() {
  return process.env.DEMO_MODE === 'true';
}

function sendDemoExecutionDisabled(res) {
  return sendError(res, {
    statusCode: 503,
    message: DEMO_EXECUTION_DISABLED_MESSAGE,
    errorCode: 'DEMO_EXECUTION_DISABLED',
  });
}

function triggerExecutionRPC(payload) {
  return new Promise((resolve, reject) => {
    schedulerClient.TriggerExecution(payload, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response);
    });
  });
}

function replayExecutionRPC(payload) {
  return new Promise((resolve, reject) => {
    schedulerClient.ReplayExecution(payload, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response);
    });
  });
}

function cancelExecutionRPC(payload) {
  return new Promise((resolve, reject) => {
    schedulerClient.CancelExecution(payload, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response);
    });
  });
}

function streamExecutionLogsRPC(payload) {
  const streamMethod = logsClient.streamExecutionLogs || logsClient.StreamExecutionLogs;
  if (typeof streamMethod !== 'function') {
    throw new Error('Logs stream RPC method is not available');
  }
  return streamMethod.call(logsClient, payload);
}

export async function triggerExecution(req, res) {
  try {
    if (isDemoModeEnabled()) {
      return sendDemoExecutionDisabled(res);
    }

    const { functionId } = req.params;
    const { inputPayload = {} } = req.body;
    const userId = req.user?.id || req.auth?.userId;

    if (!userId) {
      return sendError(res, {
        statusCode: 401,
        message: 'Authentication required',
        errorCode: 'AUTH_REQUIRED',
      });
    }

    const fn = await Function.findById(functionId).lean();
    if (!fn) {
      return sendError(res, {
        statusCode: 404,
        message: 'Function not found',
        errorCode: 'FUNCTION_NOT_FOUND',
      });
    }

    if (fn.userId.toString() !== userId.toString()) {
      return sendError(res, {
        statusCode: 403,
        message: 'Forbidden',
        errorCode: 'FORBIDDEN',
      });
    }

    const functionVersion = await FunctionVersion.findById(fn.currentVersionId).lean();
    if (!functionVersion) {
      return sendError(res, {
        statusCode: 404,
        message: 'Function version not found',
        errorCode: 'FUNCTION_VERSION_NOT_FOUND',
      });
    }

    const codeUrl = await getPresignedCodeUrl(functionVersion.codeStoragePath);

    const executionRequestPayload = {
      user_id: userId,
      function_id: functionId,
      version_id: functionVersion._id.toString(),
      code_storage_path: functionVersion.codeStoragePath,
      runtime: functionVersion.runtimeVersion,
      input_payload: JSON.stringify(inputPayload),
      timeout_seconds: 30,
    };

    let schedulerResponse;
    try {
      schedulerResponse = await triggerExecutionRPC(executionRequestPayload);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      return sendError(res, {
        statusCode: 500,
        message: 'Scheduler service error',
        errorCode: 'SCHEDULER_ERROR',
      });
    }

    return sendSuccess(res, {
      statusCode: 202,
      message: 'Execution queued',
      data: {
        executionId: schedulerResponse.execution_id,
        status: schedulerResponse.status,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    return sendError(res, {
      statusCode: 500,
      message: 'Internal server error',
      errorCode: 'INTERNAL_SERVER_ERROR',
    });
  }
}

export async function replayExecution(req, res) {
  try {
    if (isDemoModeEnabled()) {
      return sendDemoExecutionDisabled(res);
    }

    const { executionId } = req.params;
    const userId = req.user?.id || req.auth?.userId;
    const overrideInputPayload = req.body?.inputPayload;

    if (!mongoose.Types.ObjectId.isValid(executionId)) {
      return sendError(res, {
        statusCode: 400,
        message: 'Invalid execution id',
        errorCode: 'INVALID_EXECUTION_ID',
      });
    }

    const originalExecution = await Execution.findById(executionId)
      .select('_id userId functionId functionVersionId inputPayload')
      .lean();

    if (!originalExecution) {
      return sendError(res, {
        statusCode: 404,
        message: 'Execution not found',
        errorCode: 'EXECUTION_NOT_FOUND',
      });
    }

    if (!userId || originalExecution.userId.toString() !== userId.toString()) {
      return sendError(res, {
        statusCode: 403,
        message: 'Forbidden',
        errorCode: 'FORBIDDEN',
      });
    }

    const inputPayload = overrideInputPayload ?? originalExecution.inputPayload ?? {};

    const replayRequestPayload = {
      execution_id: executionId,
      user_id: userId.toString(),
      input_override: JSON.stringify(inputPayload),
    };

    let schedulerResponse;
    try {
      schedulerResponse = await replayExecutionRPC(replayRequestPayload);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      return sendError(res, {
        statusCode: 500,
        message: 'Scheduler service error',
        errorCode: 'SCHEDULER_ERROR',
      });
    }

    return sendSuccess(res, {
      statusCode: 202,
      message: 'Replay execution queued',
      data: {
        executionId: schedulerResponse.new_execution_id,
        status: schedulerResponse.status,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    return sendError(res, {
      statusCode: 500,
      message: 'Internal server error',
      errorCode: 'INTERNAL_SERVER_ERROR',
    });
  }
}

export async function cancelExecution(req, res) {
  try {
    if (isDemoModeEnabled()) {
      return sendDemoExecutionDisabled(res);
    }

    const { executionId } = req.params;
    const userId = req.user?.id || req.auth?.userId;

    if (!mongoose.Types.ObjectId.isValid(executionId)) {
      return sendError(res, {
        statusCode: 400,
        message: 'Invalid execution id',
        errorCode: 'INVALID_EXECUTION_ID',
      });
    }

    const execution = await Execution.findById(executionId).lean();
    if (!execution) {
      return sendError(res, {
        statusCode: 404,
        message: 'Execution not found',
        errorCode: 'EXECUTION_NOT_FOUND',
      });
    }

    if (!userId || execution.userId.toString() !== userId.toString()) {
      return sendError(res, {
        statusCode: 403,
        message: 'Forbidden',
        errorCode: 'FORBIDDEN',
      });
    }

    const cancellableStatuses = new Set(['QUEUED', 'RUNNING']);
    if (!cancellableStatuses.has(execution.status)) {
      return sendError(res, {
        statusCode: 400,
        message: 'Execution cannot be cancelled',
        errorCode: 'EXECUTION_NOT_CANCELLABLE',
      });
    }

    const cancelRequestPayload = {
      execution_id: execution._id.toString(),
      user_id: userId.toString(),
    };

    try {
      await cancelExecutionRPC(cancelRequestPayload);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      return sendError(res, {
        statusCode: 500,
        message: 'Scheduler service error',
        errorCode: 'SCHEDULER_ERROR',
      });
    }

    return sendSuccess(res, {
      statusCode: 202,
      message: 'Cancel request accepted',
      data: {
        executionId: execution._id.toString(),
        status: 'CANCEL_REQUESTED',
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    return sendError(res, {
      statusCode: 500,
      message: 'Internal server error',
      errorCode: 'INTERNAL_SERVER_ERROR',
    });
  }
}

export async function getExecution(req, res) {
  try {
    const { executionId } = req.params;
    const userId = req.user?.id || req.auth?.userId;

    if (!mongoose.Types.ObjectId.isValid(executionId)) {
      return sendError(res, {
        statusCode: 400,
        message: 'Invalid execution id',
        errorCode: 'INVALID_EXECUTION_ID',
      });
    }

    const execution = await Execution.findById(executionId)
      .select('_id userId functionId functionVersionId status createdAt startedAt completedAt errorMessage output')
      .lean();

    if (!execution) {
      return sendError(res, {
        statusCode: 404,
        message: 'Execution not found',
        errorCode: 'EXECUTION_NOT_FOUND',
      });
    }

    if (!userId || execution.userId.toString() !== userId.toString()) {
      return sendError(res, {
        statusCode: 403,
        message: 'Forbidden',
        errorCode: 'FORBIDDEN',
      });
    }

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Execution fetched successfully',
      data: {
        executionId: execution._id.toString(),
        functionId: execution.functionId.toString(),
        functionVersionId: execution.functionVersionId.toString(),
        status: execution.status,
        createdAt: execution.createdAt,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        errorMessage: execution.errorMessage || null,
        output: execution.output || null,
      },
    });
  } catch (error) {
    console.error(error);
    return sendError(res, {
      statusCode: 500,
      message: 'Internal server error',
      errorCode: 'INTERNAL_SERVER_ERROR',
    });
  }
}

export async function getExecutionsByFunction(req, res) {
  try {
    const { functionId } = req.params;
    const userId = req.user?.id || req.auth?.userId;

    if (!mongoose.Types.ObjectId.isValid(functionId)) {
      return sendError(res, {
        statusCode: 400,
        message: 'Invalid function id',
        errorCode: 'INVALID_FUNCTION_ID',
      });
    }

    const executions = await Execution.find({
      functionId,
      userId,
    })
      .select('_id status createdAt startedAt completedAt errorMessage output')
      .sort({ createdAt: -1 })
      .lean();
    return sendSuccess(res, {
      statusCode: 200,
      message: 'Executions fetched successfully',
      data: {
        executions: executions.map((execution) => ({
          executionId: execution._id.toString(),
          status: execution.status,
          createdAt: execution.createdAt,
          startedAt: execution.startedAt,
          completedAt: execution.completedAt,
          errorMessage: execution.errorMessage,
          output: execution.output
        })),
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    return sendError(res, {
      statusCode: 500,
      message: 'Internal server error',
      errorCode: 'INTERNAL_SERVER_ERROR',
    });
  }
}

export async function streamExecutionLogs(req, res) {
  try {
    const { executionId } = req.params;
    const userId = req.user?.id || req.auth?.userId;

    if (!mongoose.Types.ObjectId.isValid(executionId)) {
      return sendError(res, {
        statusCode: 400,
        message: 'Invalid execution id',
        errorCode: 'INVALID_EXECUTION_ID',
      });
    }

    const execution = await Execution.findById(executionId).select('_id userId status').lean();
    if (!execution) {
      return sendError(res, {
        statusCode: 404,
        message: 'Execution not found',
        errorCode: 'EXECUTION_NOT_FOUND',
      });
    }

    if (!userId || execution.userId.toString() !== userId.toString()) {
      return sendError(res, {
        statusCode: 403,
        message: 'Forbidden',
        errorCode: 'FORBIDDEN',
      });
    }

    if (activeExecutionLogStreams.has(executionId)) {
      return sendError(res, {
        statusCode: 409,
        message: 'Log stream already active for this execution',
        errorCode: 'EXECUTION_LOG_STREAM_ACTIVE',
      });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    res.write(`event: connected\ndata: ${JSON.stringify({ executionId, status: execution.status })}\n\n`);

    const grpcStream = streamExecutionLogsRPC({ execution_id: executionId });

    const heartbeat = setInterval(() => {
      res.write('event: heartbeat\ndata: {}\n\n');
    }, 15000);

    activeExecutionLogStreams.set(executionId, {
      userId: userId.toString(),
      grpcStream,
      heartbeat,
    });

    const cleanup = () => {
      const streamState = activeExecutionLogStreams.get(executionId);
      if (!streamState) {
        return;
      }

      clearInterval(streamState.heartbeat);
      const grpc = streamState.grpcStream;
      if (grpc) {
        if (typeof grpc.cancel === 'function') {
          grpc.cancel();
        } else if (typeof grpc.destroy === 'function') {
          grpc.destroy();
        } else if (typeof grpc.end === 'function') {
          grpc.end();
        }
      }

      activeExecutionLogStreams.delete(executionId);
    };

    req.on('close', () => {
      cleanup();
      if (!res.writableEnded) {
        res.end();
      }
    });

    grpcStream.on('data', (msg) => {
      const logEvent = {
        executionId: msg.execution_id,
        timestamp: msg.timestamp,
        stream: msg.stream,
        message: msg.message,
      };
      res.write(`event: log\ndata: ${JSON.stringify(logEvent)}\n\n`);
    });

    grpcStream.on('end', () => {
      cleanup();
      if (!res.writableEnded) {
        res.write(`event: complete\ndata: ${JSON.stringify({ executionId })}\n\n`);
        res.end();
      }
    });

    grpcStream.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      cleanup();
      if (!res.writableEnded) {
        res.write('event: error\ndata: {"message":"Log stream failed"}\n\n');
        res.end();
      }
    });

    return null;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);

    if (res.headersSent) {
      if (!res.writableEnded) {
        res.end();
      }
      return null;
    }

    return sendError(res, {
      statusCode: 500,
      message: 'Internal server error',
      errorCode: 'INTERNAL_SERVER_ERROR',
    });
  }
}
