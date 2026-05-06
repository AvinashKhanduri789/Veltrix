import path from 'node:path';
import { fileURLToPath } from 'node:url';

import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const PROTO_PATH = path.resolve(__dirname, '../../../../proto/logs.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const logsProto = grpc.loadPackageDefinition(packageDefinition).veltrix.logs;


const logsClient = new logsProto.LogsService(
  process.env.LOGS_GRPC_ADDR || 'logs-service:50053',
  grpc.credentials.createInsecure(),
);

export default logsClient;
