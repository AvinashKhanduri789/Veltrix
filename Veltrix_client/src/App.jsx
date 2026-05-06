import { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import FunctionPanel from './components/FunctionPanel';
import ExecutionList from './components/ExecutionList';
import ExecutionDetails from './components/ExecutionDetails';
import { api } from './utils/api';

function App() {
  const [functions, setFunctions] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [selectedFunctionId, setSelectedFunctionId] = useState(null);
  const [selectedExecutionId, setSelectedExecutionId] = useState(null);
  const [selectedExecutionData, setSelectedExecutionData] = useState(null);

  const pollingIntervalRef = useRef(null);

  const fetchFunctions = useCallback(async () => {
    try {
      const res = await api.getFunctions();
      const fns = res.data?.functions || res.functions || res;
      setFunctions(Array.isArray(fns) ? fns : []);
    } catch (err) {
      console.error("Failed to fetch functions:", err);
      alert("Failed to load functions");
    }
  }, []);

  useEffect(() => {
    fetchFunctions();
  }, [fetchFunctions]);

  const fetchExecutions = useCallback(async (functionId) => {
    console.log("Fetching executions for functionId:", functionId);
    console.log("functionId:", functionId);

    if (!functionId) {
      setExecutions([]);
      return;
    }
    try {
      const res = await api.getExecutionsByFunction(functionId);
      const execs = res.data?.executions || res.executions || res || [];
      // Sort by createdAt descending to have newest first
      const sortedExecs = Array.isArray(execs) ? [...execs].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)) : [];
      setExecutions(sortedExecs);
      return sortedExecs;
    } catch (err) {
      console.error("Failed to fetch executions:", err);
      setExecutions([]);
      return [];
    }
  }, []);

  const handleFunctionSelect = useCallback(async (functionId) => {
    console.log("Selected functionId:", functionId);
    setSelectedFunctionId(functionId);
    setSelectedExecutionId(null);
    setSelectedExecutionData(null);
    if (functionId) {
      const execs = await fetchExecutions(functionId);
      if (execs && execs.length > 0) {
        const latestExecId = execs[0].executionId || execs[0].id || execs[0]._id;
        setSelectedExecutionId(latestExecId);
      }
    }
  }, [fetchExecutions]);

  const handleTriggerExecution = async (functionId, payload) => {
    console.log("handleTriggerExecution", functionId, payload);
    const res = await api.triggerExecution(functionId, payload);
    const triggerData = res.data?.execution || res.data || res;

    // Refresh executions immediately and auto-select latest
    const execs = await fetchExecutions(functionId);
    if (execs && execs.length > 0) {
      const latestExecId = execs[0].executionId || execs[0].id || execs[0]._id;
      // It's possible the immediate fetch doesn't have it if async, fallback to response ID if available
      const newExecId = triggerData.executionId || latestExecId;
      setSelectedExecutionId(newExecId);
    } else if (triggerData.executionId) {
      setSelectedExecutionId(triggerData.executionId);
    }
  };

  // Execution Details Polling
  useEffect(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (!selectedExecutionId) {
      setSelectedExecutionData(null);
      return;
    }

    const fetchExecutionDetails = async () => {
      try {
        const res = await api.getExecution(selectedExecutionId);
        const execData = res.data?.execution || res.data || res.execution || res;
        setSelectedExecutionData(execData);

        // Update the execution in the list as well to reflect status changes
        setExecutions(prev => prev.map(e => {
          const id = e.executionId || e.id || e._id;
          return id === selectedExecutionId ? { ...e, ...execData } : e;
        }));

        // Stop polling if completed or failed
        const status = execData.status?.toUpperCase();
        if (status === 'COMPLETED' || status === 'SUCCESS' || status === 'FAILED') {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
      } catch (err) {
        console.error("Failed to fetch execution details:", err);
      }
    };

    // Fetch immediately
    fetchExecutionDetails();

    // Set up polling every 2.5 seconds
    pollingIntervalRef.current = setInterval(fetchExecutionDetails, 2500);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [selectedExecutionId]);

  return (
    <div className="min-h-screen flex flex-col items-center">
      <div className="w-full max-w-[1200px] flex flex-col h-screen p-4 md:p-8">
        <Header />

        <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
          {/* Left Column: Functions Panel */}
          <div className="w-full md:w-[350px] flex-shrink-0">
            <FunctionPanel
              functions={functions}
              fetchFunctions={fetchFunctions}
              onFunctionSelect={handleFunctionSelect}
              selectedFunctionId={selectedFunctionId}
              onTriggerExecution={handleTriggerExecution}
            />
          </div>

          {/* Right Column: Executions Panel (Split into List and Details) */}
          <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0 min-w-0">
            {/* Executions List */}
            <div className="w-full md:w-[300px] flex-shrink-0">
              <ExecutionList
                executions={executions}
                selectedExecutionId={selectedExecutionId}
                onSelectExecution={setSelectedExecutionId}
                selectedFunctionId={selectedFunctionId}
              />
            </div>

            {/* Execution Details */}
            <div className="flex-1 min-w-0">
              <ExecutionDetails
                execution={selectedExecutionData}
                selectedFunctionId={selectedFunctionId}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
