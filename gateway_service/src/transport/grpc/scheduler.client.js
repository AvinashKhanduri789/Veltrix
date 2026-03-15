import path from 'node:path';
import { fileURLToPath } from 'node:url';

import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROTO_PATH = path.resolve(__dirname, '../../../../proto/scheduler.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const schedulerProto = grpc.loadPackageDefinition(packageDefinition).veltrix.scheduler;

const schedulerClient = new schedulerProto.SchedulerService(
  process.env.SCHEDULER_GRPC_ADDR || 'localhost:50051',
  grpc.credentials.createInsecure(),
);

export default schedulerClient;
