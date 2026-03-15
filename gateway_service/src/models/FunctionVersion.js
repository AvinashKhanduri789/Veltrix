import mongoose from 'mongoose';

const functionVersionSchema = new mongoose.Schema(
  {
    functionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Function',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    versionNumber: {
      type: Number,
      required: true,
    },
    codeStoragePath: {
      type: String,
      required: true,
    },
    runtimeVersion: {
      type: String,
      required: true,
    },
    containerImageTag: {
      type: String,
      required: true,
    },
    codeHash: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

functionVersionSchema.index({ functionId: 1, versionNumber: 1 }, { unique: true });

export default mongoose.model('FunctionVersion', functionVersionSchema);
