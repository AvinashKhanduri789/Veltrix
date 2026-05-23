import {
  Boxes,
  Cloud,
  Container,
  Database,
  GitBranch,
  HardDrive,
  Network,
  Server,
  Workflow,
} from 'lucide-react';

const components = [
  {
    icon: Network,
    title: 'API Gateway',
    body: 'Node.js REST boundary for authentication, function upload, execution APIs, gRPC clients, and SSE log streaming.',
  },
  {
    icon: Workflow,
    title: 'Scheduler',
    body: 'Go control-plane service that creates execution records, publishes jobs, handles replay/cancel, and updates lifecycle state.',
  },
  {
    icon: GitBranch,
    title: 'Kafka',
    body: 'Event backbone for execution jobs, execution status events, and log streams between scheduler, workers, and logs service.',
  },
  {
    icon: Server,
    title: 'Worker Services',
    body: 'Go data-plane workers that consume jobs, fetch code, coordinate runtime calls, and publish logs/results back to Kafka.',
  },
  {
    icon: Container,
    title: 'Runtime Containers',
    body: 'Isolated Python and Node runtime servers that spawn short-lived child processes with limits and cleanup.',
  },
  {
    icon: Database,
    title: 'MongoDB',
    body: 'Persistent metadata store for users, functions, versions, execution state, outputs, and historical records.',
  },
  {
    icon: HardDrive,
    title: 'Object Storage',
    body: 'MinIO stores uploaded function source files while Redis supports worker-side code caching.',
  },
  {
    icon: Cloud,
    title: 'Demo Deployment',
    body: 'Hosted showcase keeps read/history/upload surfaces available while infrastructure-heavy execution APIs are gated.',
  },
];

const flow = [
  'Client uploads or selects a function through the API Gateway.',
  'Gateway validates the request and sends execution commands to Scheduler over gRPC.',
  'Scheduler persists execution state and publishes a job onto Kafka.',
  'Worker Service consumes the job, retrieves code from storage/cache, and calls the correct runtime container.',
  'Runtime Container executes user code in an isolated child process and streams stdout/stderr.',
  'Worker publishes lifecycle events and logs back to Kafka.',
  'Scheduler updates MongoDB while Logs Service streams logs back to Gateway and the frontend.',
];

export default function ArchitecturePage() {
  return (
    <main className="flex-1 overflow-y-auto pb-8">
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
              System Architecture
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-950">
              Distributed execution pipeline
            </h2>
          </div>
          <div className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-600">
            Public demo: execution gated
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-950 p-5 text-white">
          <div className="grid gap-3 text-sm font-medium md:grid-cols-4">
            <Node label="Client" />
            <Arrow />
            <Node label="API Gateway" />
            <Arrow />
            <Node label="Scheduler" />
            <Arrow />
            <Node label="Kafka" />
            <Arrow />
            <Node label="Worker Services" />
            <Arrow />
            <Node label="Runtime Containers" />
            <Arrow />
            <Node label="Kafka Events + Logs" />
            <Arrow />
            <Node label="Logs Service + SSE" />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {components.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white text-gray-800 shadow-sm">
                  <Icon size={18} />
                </div>
                <h3 className="text-sm font-semibold text-gray-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{item.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
          <div className="mb-5 flex items-center gap-2">
            <Boxes size={18} className="text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-950">Execution lifecycle flow</h3>
          </div>
          <ol className="space-y-3">
            {flow.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm leading-6 text-gray-600">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-950 text-xs font-semibold text-white">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
          <h3 className="text-sm font-semibold text-gray-950">Demo scope</h3>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            This branch keeps the real scheduler, worker, Kafka, Redis, MinIO, runtime container,
            protobuf, replay, and distributed execution code in place. Only public-demo execution
            entry points are gated so reviewers can inspect the architecture without provisioning
            the full infrastructure.
          </p>
          <div className="mt-5 rounded-xl border border-green-100 bg-green-50 p-4 text-sm leading-6 text-green-800">
            Function upload, function browsing, execution history, execution details, and persisted
            logs/results remain available for project review.
          </div>
        </div>
      </section>
    </main>
  );
}

function Node({ label }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-center">
      {label}
    </div>
  );
}

function Arrow() {
  return (
    <div className="hidden items-center justify-center text-gray-500 md:flex" aria-hidden="true">
      -&gt;
    </div>
  );
}
