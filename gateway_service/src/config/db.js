import mongoose from 'mongoose';

async function connectDB() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGO_URI is not set in environment variables');
  }

  await mongoose.connect(mongoUri);

  // eslint-disable-next-line no-console
  console.log('MongoDB connected');
}

export { connectDB };
