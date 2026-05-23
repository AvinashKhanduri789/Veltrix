import { AlertTriangle } from 'lucide-react';

export default function DemoBanner() {
  return (
    <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <AlertTriangle size={20} />
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-amber-900">
            DEMO DEPLOYMENT MODE
          </h2>
          <p className="mt-2 text-sm leading-6 text-amber-950">
            This public deployment is a lightweight demonstration version of Veltrix.
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            The complete distributed execution system including Scheduler, Kafka, Worker Services,
            Runtime Containers, and orchestration pipelines was successfully implemented and tested
            locally.
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            Live execution features are disabled in this demo deployment because the full
            infrastructure is resource-intensive and not included in the public hosted version.
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-amber-950">
            The complete architecture and implementation still exist in the source code repository.
          </p>
        </div>
      </div>
    </section>
  );
}
