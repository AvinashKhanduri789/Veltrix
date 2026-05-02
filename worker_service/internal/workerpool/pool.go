package workerpool

import (
	"context"
	"log"
	"sync"

	eventspb "veltrix/proto/eventspb"
)

// WorkerFunc defines how a job is processed
type WorkerFunc func(ctx context.Context, job *eventspb.ExecutionJob)

// WorkerPool manages workers and job queue
type WorkerPool struct {
	jobQueue   chan *eventspb.ExecutionJob
	workerSize int
	handler    WorkerFunc
	wg sync.WaitGroup
}

// NewWorkerPool creates a new pool
func NewWorkerPool(workerSize int, queueSize int, handler WorkerFunc) *WorkerPool {
	return &WorkerPool{
		jobQueue:   make(chan *eventspb.ExecutionJob, queueSize),
		workerSize: workerSize,
		handler:    handler,
	}
}

// Start initializes worker goroutines
func (wp *WorkerPool) Start(ctx context.Context) {
	log.Printf("starting worker pool with %d workers", wp.workerSize)

	for i := 0; i < wp.workerSize; i++ {
		wp.wg.Add(1)

		worker := NewWorker(i, wp.handler)

		go func(w *Worker) {
			defer wp.wg.Done()
			
			w.Start(ctx, wp.jobQueue)
		}(worker)
	}
}

// Submit adds job to queue (safe API)
func (wp *WorkerPool) Submit(job *eventspb.ExecutionJob) {
	wp.jobQueue <- job
}

// Stop gracefully shuts down workers
func (wp *WorkerPool) Stop() {
	log.Println("stopping worker pool")

	close(wp.jobQueue) // signal no more jobs
	wp.wg.Wait()       // wait for workers to finish

	log.Println("worker pool stopped")
}
