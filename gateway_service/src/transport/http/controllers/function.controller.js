import mongoose from 'mongoose';

import Function from '../../../models/Function.js';
import FunctionVersion from '../../../models/FunctionVersion.js';
import {
  getContainerImageTag,
  getRuntimeVersion,
  hasValidExtensionForLanguage,
} from '../../../utils/function/function-runtime.util.js';
import { buildFunctionObjectKey, hashCodeBuffer } from '../../../utils/function/function-storage.util.js';
import { sendError, sendSuccess } from '../../../utils/http/response.util.js';
import { putCodeObject, removeCodeObject } from '../../../utils/storage/minio.util.js';

export async function createFunction(req, res) {
  try {
    const userId = req.user?.id;
    const { name, language } = req.body;
    const { file } = req;

    const isLanguageValid = ['python', 'node', 'go'].includes(language);
    if (!userId || !name || !isLanguageValid || !file) {
      return sendError(res, {
        statusCode: 400,
        message: 'Invalid request payload',
        errorCode: 'INVALID_REQUEST_PAYLOAD',
      });
    }

    const normalizedName = name.trim();
    const existingFunction = await Function.findOne({ userId, name: normalizedName }).select('_id').lean();
    if (existingFunction) {
      return sendError(res, {
        statusCode: 409,
        message: 'Function with this name already exists',
        errorCode: 'FUNCTION_ALREADY_EXISTS',
      });
    }

    const functionId = new mongoose.Types.ObjectId();
    const versionNumber = 1;
    const objectKey = buildFunctionObjectKey(userId, functionId.toString(), versionNumber, file.originalname);

    await putCodeObject(
      objectKey,
      file.buffer,
      file.size || file.buffer.length,
      { 'Content-Type': file.mimetype || 'application/octet-stream' },
    );

    const runtimeVersion = getRuntimeVersion(language);
    const containerImageTag = getContainerImageTag(language);
    const codeHash = hashCodeBuffer(file.buffer);

    if (!runtimeVersion || !containerImageTag) {
      await removeCodeObject(objectKey).catch(() => {});
      return sendError(res, {
        statusCode: 400,
        message: 'Invalid request payload',
        errorCode: 'INVALID_REQUEST_PAYLOAD',
      });
    }

    let functionVersion;
    try {
      functionVersion = await FunctionVersion.create({
        functionId,
        userId,
        versionNumber,
        codeStoragePath: objectKey,
        runtimeVersion,
        containerImageTag,
        codeHash,
        createdAt: new Date(),
      });
    } catch (error) {
      await removeCodeObject(objectKey).catch(() => {});
      throw error;
    }

    try {
      await Function.create({
        _id: functionId,
        userId,
        name: normalizedName,
        language,
        currentVersionId: functionVersion._id,
      });
    } catch (error) {
      await FunctionVersion.deleteOne({ _id: functionVersion._id }).catch(() => {});
      await removeCodeObject(objectKey).catch(() => {});

      if (error?.name === 'MongoServerError' && error?.code === 11000) {
        return sendError(res, {
          statusCode: 409,
          message: 'Function with this name already exists',
          errorCode: 'FUNCTION_ALREADY_EXISTS',
        });
      }

      throw error;
    }

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Function created successfully',
      data: {
        functionId: functionId.toString(),
        version: 1,
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

export async function updateFunction(req, res) {
  try {
    const userId = req.user?.id;
    const functionId = req.params?.id;
    const { file } = req;

    if (!userId || !functionId || !file) {
      return sendError(res, {
        statusCode: 400,
        message: 'Invalid request payload',
        errorCode: 'INVALID_REQUEST_PAYLOAD',
      });
    }

    const fn = await Function.findById(functionId);
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

    if (!hasValidExtensionForLanguage(file.originalname, fn.language)) {
      return sendError(res, {
        statusCode: 400,
        message: 'Invalid request payload',
        errorCode: 'INVALID_REQUEST_PAYLOAD',
      });
    }

    const latestVersion = await FunctionVersion.findOne({ functionId }).sort({ versionNumber: -1 }).lean();
    const nextVersion = (latestVersion?.versionNumber || 0) + 1;

    const objectKey = buildFunctionObjectKey(userId, functionId, nextVersion, file.originalname);

    await putCodeObject(
      objectKey,
      file.buffer,
      file.size || file.buffer.length,
      { 'Content-Type': file.mimetype || 'application/octet-stream' },
    );

    const runtimeVersion = getRuntimeVersion(fn.language);
    const containerImageTag = getContainerImageTag(fn.language);
    const codeHash = hashCodeBuffer(file.buffer);

    if (!runtimeVersion || !containerImageTag) {
      await removeCodeObject(objectKey).catch(() => {});
      return sendError(res, {
        statusCode: 400,
        message: 'Invalid request payload',
        errorCode: 'INVALID_REQUEST_PAYLOAD',
      });
    }

    let newVersion;
    try {
      newVersion = await FunctionVersion.create({
        functionId,
        userId,
        versionNumber: nextVersion,
        codeStoragePath: objectKey,
        runtimeVersion,
        containerImageTag,
        codeHash,
        createdAt: new Date(),
      });
    } catch (error) {
      await removeCodeObject(objectKey).catch(() => {});
      throw error;
    }

    try {
      fn.currentVersionId = newVersion._id;
      await fn.save();
    } catch (error) {
      await FunctionVersion.deleteOne({ _id: newVersion._id }).catch(() => {});
      await removeCodeObject(objectKey).catch(() => {});
      throw error;
    }

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Function updated successfully',
      data: {
        functionId: fn._id.toString(),
        version: nextVersion,
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

export async function getFunctions(req, res) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, {
        statusCode: 401,
        message: 'Unauthorized',
        errorCode: 'UNAUTHORIZED',
      });
    }

    const functions = await Function.find({ userId })
      .select('_id name language currentVersionId createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();

    const currentVersionIds = functions
      .map((fn) => fn.currentVersionId)
      .filter(Boolean);

    const versions = await FunctionVersion.find({ _id: { $in: currentVersionIds } })
      .select('_id versionNumber')
      .lean();

    const versionMap = new Map(
      versions.map((version) => [version._id.toString(), version.versionNumber]),
    );

    const result = functions.map((fn) => ({
      functionId: fn._id.toString(),
      name: fn.name,
      language: fn.language,
      currentVersion: versionMap.get(fn.currentVersionId?.toString()) || null,
      createdAt: fn.createdAt,
      updatedAt: fn.updatedAt,
    }));

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Functions fetched successfully',
      data: {
        functions: result,
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

export async function getFunctionById(req, res) {
  try {
    const userId = req.user?.id;
    const functionId = req.params?.id;

    if (!userId) {
      return sendError(res, {
        statusCode: 401,
        message: 'Unauthorized',
        errorCode: 'UNAUTHORIZED',
      });
    }

    if (!functionId) {
      return sendError(res, {
        statusCode: 400,
        message: 'Invalid request payload',
        errorCode: 'INVALID_REQUEST_PAYLOAD',
      });
    }

    const fn = await Function.findById(functionId)
      .select('_id userId name language createdAt updatedAt')
      .lean();

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

    const versions = await FunctionVersion.find({ functionId: fn._id })
      .select('versionNumber runtimeVersion containerImageTag createdAt')
      .sort({ versionNumber: -1 })
      .lean();

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Function fetched successfully',
      data: {
        functionId: fn._id.toString(),
        name: fn.name,
        language: fn.language,
        versions: versions.map((version) => ({
          version: version.versionNumber,
          runtimeVersion: version.runtimeVersion,
          containerImageTag: version.containerImageTag,
          createdAt: version.createdAt,
        })),
        createdAt: fn.createdAt,
        updatedAt: fn.updatedAt,
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

export async function deleteFunction(req, res) {
  try {
    const userId = req.user?.id;
    const functionId = req.params?.id;

    if (!userId) {
      return sendError(res, {
        statusCode: 401,
        message: 'Unauthorized',
        errorCode: 'UNAUTHORIZED',
      });
    }

    if (!functionId) {
      return sendError(res, {
        statusCode: 400,
        message: 'Invalid request payload',
        errorCode: 'INVALID_REQUEST_PAYLOAD',
      });
    }

    const fn = await Function.findById(functionId).select('_id userId').lean();
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

    const versions = await FunctionVersion.find({ functionId: fn._id })
      .select('_id codeStoragePath')
      .lean();

    // Storage cleanup happens first to avoid leaving orphaned DB refs to missing objects.
    for (const version of versions) {
      if (version.codeStoragePath) {
        await removeCodeObject(version.codeStoragePath);
      }
    }

    await FunctionVersion.deleteMany({ functionId: fn._id });
    await Function.deleteOne({ _id: fn._id });

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Function deleted successfully',
      data: null,
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
