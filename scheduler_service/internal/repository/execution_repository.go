package repository

import (
	"context"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"veltrix/scheduler_service/internal/domain"
)

type ExecutionRepository struct {
	collection *mongo.Collection
}

func NewExecutionRepository(db *mongo.Database) *ExecutionRepository {
	return &ExecutionRepository{
		collection: db.Collection("executions"),
	}
}

func (r *ExecutionRepository) CreateExecution(ctx context.Context, execution *domain.Execution) error {
	_, err := r.collection.InsertOne(ctx, execution)
	return err
}

func (r *ExecutionRepository) GetExecutionByID(ctx context.Context, id primitive.ObjectID) (*domain.Execution, error) {
	var execution domain.Execution
	if err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&execution); err != nil {
		return nil, err
	}
	return &execution, nil
}

func (r *ExecutionRepository) UpdateExecutionStatus(ctx context.Context, id primitive.ObjectID, status string) error {
	_, err := r.collection.UpdateOne(
		ctx,
		bson.M{"_id": id},
		bson.M{"$set": bson.M{"status": status}},
	)
	return err
}

func (r *ExecutionRepository) UpdateExecutionFields(ctx context.Context, id primitive.ObjectID, fields bson.M) error {
	_, err := r.collection.UpdateOne(
		ctx,
		bson.M{"_id": id},
		bson.M{"$set": fields},
	)
	return err
}
