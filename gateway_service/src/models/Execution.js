import mongoose from 'mongoose';

const executionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    functionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Function',
      required: true,
      index: true,
    },
    functionVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FunctionVersion',
      required: true,
      index: true,
    },
    triggerType: {
      type: String,
      required: true,
      trim: true,
    },
    replayOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Execution',
      default: null,
    },
    status: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    inputPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    runtimeVersion: {
      type: String,
      required: true,
      trim: true,
    },
    containerImageTag: {
      type: String,
      required: true,
      trim: true,
    },
    timeoutMs: {
      type: Number,
      required: true,
      min: 0,
    },
    memoryLimitMb: {
      type: Number,
      required: true,
      min: 0,
    },
    exitCode: {
      type: Number,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    versionKey: false,
  },
);

export default mongoose.model('Execution', executionSchema);
