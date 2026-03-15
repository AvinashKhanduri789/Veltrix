package domain

import "time"

type ExecutionLog struct {
	ExecutionID string
	Stream      string
	Message     string
	CreatedAt   time.Time
}
