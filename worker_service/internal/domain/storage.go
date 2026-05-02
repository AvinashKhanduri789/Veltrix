package domain

import "context"

type Storage interface {
	GetCode(ctx context.Context, codePath string) ([]byte, error)
}

