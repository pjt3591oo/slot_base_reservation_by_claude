.PHONY: help up down restart logs ps clean dev build seed

# Default target
help:
	@echo "Available commands:"
	@echo "  make up        - Start PostgreSQL and Redis containers"
	@echo "  make down      - Stop and remove containers"
	@echo "  make restart   - Restart containers"
	@echo "  make logs      - View container logs"
	@echo "  make ps        - List running containers"
	@echo "  make clean     - Remove containers and volumes"
	@echo "  make dev       - Start backend development server"
	@echo "  make dev-client - Start frontend development server"
	@echo "  make build     - Build the project"
	@echo "  make seed      - Seed the database with initial data"

# Docker commands
up:
	docker-compose up -d
	@echo "Waiting for services to be ready..."
	@sleep 5
	@echo "PostgreSQL is running on localhost:5432"
	@echo "Redis is running on localhost:6379"
	@echo "pgAdmin is running on http://localhost:5050"

down:
	docker-compose down

restart:
	docker-compose restart

logs:
	docker-compose logs -f

ps:
	docker-compose ps

clean:
	docker-compose down -v
	@echo "Removed containers and volumes"

# Development commands
dev: up
	npm run dev

dev-client:
	cd client && npm run dev

build:
	npm run build
	cd client && npm run build

seed: up
	@echo "Waiting for database to be ready..."
	@sleep 5
	npm run seed

# Install dependencies
install:
	npm install
	cd client && npm install

# Run everything
start-all: up
	@echo "Starting backend and frontend servers..."
	@make -j2 dev dev-client