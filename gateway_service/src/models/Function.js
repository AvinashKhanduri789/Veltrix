import mongoose from 'mongoose';

const functionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    language: {
      type: String,
      enum: ['python', 'node', 'go'],
      required: true,
    },
    currentVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FunctionVersion',
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

functionSchema.index({ userId: 1, name: 1 }, { unique: true });

export default mongoose.model('Function', functionSchema);
