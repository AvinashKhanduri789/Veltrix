import { Clock, CheckCircle2, XCircle, Loader2, ListTree } from 'lucide-react';

export default function ExecutionList({ 
  executions, 
  selectedExecutionId, 
  onSelectExecution,
  selectedFunctionId
}) {
  const formatId = (id) => id?.substring(0, 8);

  const getStatusIcon = (status) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED':
      case 'SUCCESS':
        return <CheckCircle2 size={14} className="text-green-500" />;
      case 'FAILED':
        return <XCircle size={14} className="text-red-500" />;
      case 'RUNNING':
        return <Loader2 size={14} className="text-blue-500 animate-spin" />;
      default:
        return <Clock size={14} className="text-gray-400" />;
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

  if (!selectedFunctionId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-white rounded-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-gray-100 p-6">
        <ListTree size={40} className="mb-3 opacity-20" />
        <p className="text-sm font-medium text-gray-500">Select a function</p>
        <p className="text-xs mt-1">Choose a function to view its executions</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.04)] p-6 border border-gray-100 flex flex-col h-full">
      <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <ActivityIcon />
        Executions
      </h2>

      <div className="flex-1 overflow-y-auto pr-1">
        {executions.length === 0 ? (
          <div className="text-center py-10 flex flex-col items-center justify-center text-gray-400">
            <Clock size={30} className="mb-3 opacity-20" />
            <p className="text-xs">No executions yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {executions.map((exec) => {
              const execId = exec.executionId || exec.id || exec._id;
              const isSelected = selectedExecutionId === execId;
              const status = exec.status || 'PENDING';
              
              return (
                <div
                  key={execId}
                  onClick={() => onSelectExecution(execId)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'border-black bg-gray-50/50 shadow-sm'
                      : 'border-transparent hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div>
                    <div className="font-mono text-xs font-semibold text-gray-700">
                      {formatId(execId)}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {exec.createdAt ? new Date(exec.createdAt).toLocaleTimeString() : 'Just now'}
                    </div>
                  </div>
                  
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-semibold uppercase tracking-wider ${getStatusColor(status)}`}>
                    {getStatusIcon(status)}
                    {status}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
