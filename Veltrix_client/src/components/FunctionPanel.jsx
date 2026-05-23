import { useState } from 'react';
import { Upload, Play, Trash2, FileCode2, Loader2, Code2, ChevronDown, ShieldOff } from 'lucide-react';
import { api } from '../utils/api';

export default function FunctionPanel({
  functions,
  fetchFunctions,
  onFunctionSelect,
  selectedFunctionId,
  onTriggerExecution,
  isDemoMode = false
}) {
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('python');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [runningFnId, setRunningFnId] = useState(null);

  const handleFileSelectAndUpload = async (e) => {
    setUploadError(null);
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!name.trim()) {
      setUploadError("Please enter a function name first.");
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      await api.createFunction(name, language, selectedFile);
      setName('');
      e.target.value = ''; // reset file input
      await fetchFunctions();
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError(err.message || "Failed to create function");
      e.target.value = ''; // reset so they can try again
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    try {
      await api.deleteFunction(id);
      if (selectedFunctionId === id) {
        onFunctionSelect(null);
      }
      await fetchFunctions();
    } catch (err) {
      alert(err.message || "Failed to delete function");
    }
  };

  const handleRun = async (e, fn) => {
    e.stopPropagation();

    if (isDemoMode) {
      await onTriggerExecution(fn.functionId || fn.id || fn._id, {});
      return;
    }

    const payloadStr = prompt("Enter input payload (JSON) or leave empty:", "{}");
    if (payloadStr === null) return; // User cancelled

    let payloadObj = {};
    if (payloadStr.trim()) {
      try {
        payloadObj = JSON.parse(payloadStr);
      } catch {
        alert("Invalid JSON payload. Please enter valid JSON.");
        return;
      }
    }

    setRunningFnId(fn.functionId || fn.id || fn._id);
    try {
      await onTriggerExecution(fn.functionId || fn.id || fn._id, payloadObj);
    } catch (err) {
      alert(err.message || "Failed to trigger execution");
    } finally {
      setRunningFnId(null);
    }
  };

  const formatId = (id) => id?.substring(0, 8) || 'N/A';

  return (
    <div className="bg-white rounded-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.04)] p-6 border border-gray-100 flex flex-col h-full">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-6">
        <Code2 size={20} className="text-gray-400" />
        Functions
      </h2>
      {isDemoMode && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium leading-5 text-amber-900">
          Execution Disabled In Demo Deployment. Uploaded functions and historical execution
          records remain available for review.
        </div>
      )}

      {/* Create Form */}
      <form onSubmit={(e) => e.preventDefault()} className="mb-8 bg-gray-50/50 p-4 rounded-xl border border-gray-100/80">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isUploading}
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 disabled:opacity-50 transition-all placeholder:font-normal placeholder:text-gray-400"
              placeholder="e.g. data-processor"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Language</label>
            <div className="relative">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={isUploading}
                className="appearance-none w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 disabled:opacity-50 transition-all hover:border-gray-300 cursor-pointer"
              >
                <option value="python">Python 3.10</option>
                <option value="node">Node.js 20</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                <ChevronDown size={16} />
              </div>
            </div>
          </div>
          <label
            className={`w-full mt-2 flex items-center justify-center gap-2 bg-black text-white px-4 py-2.5 rounded-full text-sm font-medium transition-colors ${
              isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800 cursor-pointer'
            }`}
          >
            {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {isUploading ? 'Uploading...' : 'Select File & Upload'}
            <input
              type="file"
              className="sr-only"
              onChange={handleFileSelectAndUpload}
              disabled={isUploading}
            />
          </label>
          {uploadError && (
            <div className="mt-2 text-xs font-medium text-red-500 bg-red-50 p-2 rounded-lg border border-red-100">
              {uploadError}
            </div>
          )}
        </div>
      </form>

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-1">
        {!Array.isArray(functions) || functions.length === 0 ? (
          <div className="text-center py-10 flex flex-col items-center justify-center text-gray-400">
            <FileCode2 size={40} className="mb-3 opacity-20" />
            <p className="text-sm font-medium">No functions yet</p>
            <p className="text-xs mt-1">Upload a function to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {functions.map((fn) => {
              const fnId = fn.functionId || fn.id || fn._id;
              const isSelected = selectedFunctionId === fnId;
              const isRunning = runningFnId === fnId;
              
              return (
                <div
                  key={fnId}
                  onClick={() => onFunctionSelect(fnId)}
                  className={`group p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-black bg-gray-50/50 shadow-sm'
                      : 'border-transparent hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm text-gray-900">{fn.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                          {fn.language}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {fn.createdAt ? new Date(fn.createdAt).toLocaleDateString() : formatId(fnId)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleRun(e, fn)}
                        disabled={isRunning}
                        className={`flex items-center gap-1.5 rounded-lg p-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          isDemoMode
                            ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                            : 'text-gray-500 hover:bg-gray-200 hover:text-black'
                        }`}
                        title={isDemoMode ? 'Execution Disabled In Demo Deployment' : 'Run'}
                      >
                        {isRunning ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : isDemoMode ? (
                          <ShieldOff size={16} />
                        ) : (
                          <Play size={16} />
                        )}
                        {isDemoMode && <span className="hidden xl:inline">Execution Disabled In Demo Deployment</span>}
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, fnId)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
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
