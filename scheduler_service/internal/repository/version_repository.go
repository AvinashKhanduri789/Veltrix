package repository

import (
	"context"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"veltrix/scheduler_service/internal/domain"
)

type VersionRepository struct {
	collection *mongo.Collection
}

func NewVersionRepository(db *mongo.Database) *VersionRepository {
	return &VersionRepository{
		collection: db.Collection("function_versions"),
	}
}

func (r *VersionRepository) GetByID(ctx context.Context, id primitive.ObjectID) (*domain.FunctionVersion, error) {
	var version domain.FunctionVersion
	if err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&version); err != nil {
		return nil, err
	}
	return &version, nil
}
