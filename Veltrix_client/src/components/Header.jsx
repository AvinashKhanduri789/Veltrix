import { Activity } from 'lucide-react';

export default function Header() {
  return (
    <header className="flex items-center justify-between py-6 px-8 mb-6 bg-white border-b border-gray-100 shadow-sm rounded-b-2xl">
      <div className="flex items-center gap-3">
        <div className="bg-black p-2 rounded-xl text-white">
          <Activity size={20} />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">Veltrix</h1>
          <p className="text-sm text-gray-500 font-medium">Distributed Execution Platform</p>
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm font-medium border border-green-100">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
        Connected
      </div>
    </header>
  );
}
