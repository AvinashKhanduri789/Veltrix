import { useEffect, useState, useRef } from 'react';
import { api } from '../utils/api';
import { Terminal, Lock, Unlock } from 'lucide-react';

export default function LogsViewer({ executionId, status }) {
  const [logs, setLogs] = useState([]);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const bottomRef = useRef(null);
  const logsContainerRef = useRef(null);
  
  // Ref to hold the latest logs for deduplication without adding it to useEffect dependencies
  const logsRef = useRef([]);

  useEffect(() => {
    if (status !== 'RUNNING' && status !== 'PENDING') return;

    const url = api.getLogsUrl(executionId);
    let eventSource = new EventSource(url);

    eventSource.addEventListener('log', (event) => {
      try {
        const data = JSON.parse(event.data);
        
        setLogs((prev) => {
          // Deduplication based on timestamp + message, or just checking last few messages
          const isDuplicate = prev.some(
            l => l.timestamp === data.timestamp && l.message === data.message
          );
          
          if (!isDuplicate) {
            const newLogs = [...prev, data];
            logsRef.current = newLogs;
            return newLogs;
          }
          return prev;
        });
      } catch (err) {
        console.error('Failed to parse log event', err);
      }
    });

    eventSource.addEventListener('error', (event) => {
      try {
        const data = JSON.parse(event.data);
        setLogs(prev => [...prev, { level: 'STDERR', message: data.message }]);
      } catch {
        setLogs(prev => [...prev, { level: 'STDERR', message: 'Log stream failed' }]);
      }
      eventSource.close();
    });

    eventSource.onerror = (err) => {
      console.error("EventSource connection error:", err);
      // Don't close immediately on network errors, EventSource auto-reconnects by default.
    };

    return () => {
      eventSource.close();
      setLogs([]);
      logsRef.current = [];
    };
  }, [executionId, status]);

  useEffect(() => {
    if (isAutoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isAutoScroll]);

  const handleScroll = () => {
    if (!logsContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    // If user scrolls up, disable auto-scroll
    if (scrollHeight - scrollTop - clientHeight > 20) {
      setIsAutoScroll(false);
    } else {
      setIsAutoScroll(true);
    }
  };

  const toggleAutoScroll = () => {
    setIsAutoScroll(!isAutoScroll);
    if (!isAutoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1a1a1a] rounded-xl overflow-hidden shadow-inner border border-gray-800">
      <div className="flex items-center justify-between px-4 py-2 bg-[#252525] border-b border-gray-800">
        <div className="flex items-center gap-2 text-gray-400 text-xs font-mono">
          <Terminal size={14} />
          Terminal
        </div>
        <button 
          onClick={toggleAutoScroll}
          className={`flex items-center gap-1.5 text-[10px] uppercase font-semibold tracking-wider px-2 py-1 rounded transition-colors ${
            isAutoScroll ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-700 text-gray-400 hover:text-white'
          }`}
        >
          {isAutoScroll ? <Lock size={12} /> : <Unlock size={12} />}
          {isAutoScroll ? 'Auto-scroll On' : 'Auto-scroll Off'}
        </button>
      </div>
      
      <div 
        className="flex-1 overflow-y-auto p-4 font-mono text-[13px] leading-relaxed"
        ref={logsContainerRef}
        onScroll={handleScroll}
      >
        {logs.length === 0 ? (
          <div className="text-gray-500 italic">Waiting for logs...</div>
        ) : (
          logs.map((log, index) => {
            let colorClass = 'text-gray-300'; // Default STDOUT
            if (log.level === 'STDERR' || log.type === 'error') colorClass = 'text-red-400';
            else if (log.level === 'RESULT' || log.type === 'result') colorClass = 'text-green-400';

            return (
              <div key={index} className={`mb-1 break-words ${colorClass}`}>
                {log.message || JSON.stringify(log)}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
