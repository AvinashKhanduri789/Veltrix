import { Clock, CheckCircle2, XCircle, Loader2, Info } from 'lucide-react';
import LogsViewer from './LogsViewer';

export default function ExecutionDetails({ execution, selectedFunctionId }) {
  if (!selectedFunctionId) {
    return null; // The parent will handle the layout, but if no function, we don't show anything here.
  }

  if (!execution) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-white rounded-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-gray-100 p-6">
        <Info size={40} className="mb-3 opacity-20" />
        <p className="text-sm font-medium text-gray-500">No execution selected</p>
        <p className="text-xs mt-1">Select an execution from the list to view details</p>
      </div>
    );
  }

  const getStatusIcon = (status) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED':
      case 'SUCCESS':
        return <CheckCircle2 size={16} className="text-green-500" />;
      case 'FAILED':
        return <XCircle size={16} className="text-red-500" />;
      case 'RUNNING':
        return <Loader2 size={16} className="text-blue-500 animate-spin" />;
      default:
        return <Clock size={16} className="text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED':
      case 'SUCCESS': return 'bg-green-50 text-green-700 border-green-100';
      case 'FAILED': return 'bg-red-50 text-red-700 border-red-100';
      case 'RUNNING': return 'bg-blue-50 text-blue-700 border-blue-100';
      default: return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  };

  const status = execution.status || 'PENDING';
  const execId = execution.executionId || execution.id || execution._id;

  return (
    <div className="bg-white rounded-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.04)] p-6 border border-gray-100 flex flex-col h-full overflow-hidden">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
            Execution Details
          </h2>
          <div className="font-mono text-xs text-gray-500 mt-1">
            {execId}
          </div>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold uppercase tracking-wider ${getStatusColor(status)}`}>
          {getStatusIcon(status)}
          {status}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
          <div className="text-[10px] uppercase font-semibold text-gray-500 mb-1">Created At</div>
          <div className="text-sm font-medium text-gray-900">
            {execution.createdAt ? new Date(execution.createdAt).toLocaleString() : 'N/A'}
          </div>
        </div>
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
          <div className="text-[10px] uppercase font-semibold text-gray-500 mb-1">Duration</div>
          <div className="text-sm font-medium text-gray-900">
            {/* Mock duration or calculate if finishedAt exists */}
            {execution.durationMs ? `${execution.durationMs}ms` : '-'}
          </div>
        </div>
      </div>

      {(status === 'RUNNING' || status === 'PENDING') && (
        <div className="flex-1 min-h-0 flex flex-col">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Live Logs</h3>
          <LogsViewer executionId={execId} status={status} />
        </div>
      )}

      {(status === 'COMPLETED' || status === 'SUCCESS' || status === 'FAILED') && (
        <div className="flex-1 min-h-0 flex flex-col">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
            {status === 'FAILED' ? 'Error' : 'Output'}
          </h3>
          <div className="flex-1 bg-[#1a1a1a] rounded-xl p-4 overflow-y-auto font-mono text-[13px] leading-relaxed text-gray-300 shadow-inner">
            {status === 'FAILED' 
              ? (execution.errorMessage || execution.error || 'No error message available.') 
              : (execution.output || execution.result || 'No output available.')}
          </div>
        </div>
      )}
    </div>
  );
}
