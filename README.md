# Idea Collector

A simple web application for collecting, voting on, and discussing ideas. Built with Node.js and designed to run in Docker with persistent storage.

## Features

- 📝 Submit new ideas with title and optional description
- 👍 Vote on ideas to move them up in priority
- 💬 Add notes to ideas for additional context and discussion
- 📎 Attach files to ideas (up to 10MB per file)
- 🎨 Beautiful, responsive modern UI
- 🐳 Docker-ready with persistent volume support
- ✅ Comprehensive unit tests

## Tech Stack

- **Backend**: Node.js with Express
- **Database**: SQLite (file-based, perfect for Docker volumes)
- **Frontend**: Vanilla JavaScript with modern CSS
- **File Storage**: Local filesystem with multer
- **Testing**: Jest with supertest
- **Containerization**: Docker & Docker Compose

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Build and run the application
docker-compose up -d

# The app will be available at http://localhost:3000
```

### Using Docker

```bash
# Build the image
docker build -t idea-collector .

# Run with a named volume for persistence
docker run -d \
  -p 3000:3000 \
  -v idea-data:/app/data \
  --name idea-collector-app \
  idea-collector
```

### Local Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test
```

## API Endpoints

- `GET /api/ideas` - Get all ideas sorted by votes
- `POST /api/ideas` - Create a new idea
- `GET /api/ideas/:id` - Get a single idea with notes and attachments
- `POST /api/ideas/:id/vote` - Vote for an idea
- `POST /api/ideas/:id/notes` - Add a note to an idea
- `POST /api/ideas/:id/attachments` - Upload a file attachment
- `GET /api/attachments/:id/download` - Download an attachment

## Environment Variables

- `PORT` - Server port (default: 3000)
- `DATA_DIR` - Directory for database and uploads (default: ./data)
- `NODE_ENV` - Environment mode (development/production/test)

## Data Persistence

All data is stored in the `DATA_DIR` directory:
- `ideas.db` - SQLite database file
- `uploads/` - Uploaded file attachments

When using Docker, this directory is mounted as a volume to ensure data persists across container restarts.

## Testing

The application includes comprehensive unit tests for all API endpoints:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# View coverage report
npm test -- --coverage
```

## Project Structure

```
idea-collector/
├── server.js           # Express server and API routes
├── server.test.js      # Unit tests
├── package.json        # Dependencies and scripts
├── Dockerfile          # Docker image configuration
├── docker-compose.yml  # Docker Compose configuration
├── public/            # Frontend files
│   ├── index.html     # Main HTML file
│   ├── styles.css     # Styling
│   └── app.js         # Frontend JavaScript
└── data/              # Persistent data (gitignored)
    ├── ideas.db       # SQLite database
    └── uploads/       # File attachments
```

## Development

### Adding New Features

1. Update the database schema in `server.js`
2. Add new API endpoints
3. Update the frontend to use new endpoints
4. Add unit tests for new functionality
5. Update this README

### Database Schema

**ideas**
- id (TEXT, PRIMARY KEY)
- title (TEXT, NOT NULL)
- description (TEXT)
- votes (INTEGER, DEFAULT 0)
- created_at (DATETIME)
- updated_at (DATETIME)

**notes**
- id (TEXT, PRIMARY KEY)
- idea_id (TEXT, FOREIGN KEY)
- content (TEXT, NOT NULL)
- created_at (DATETIME)

**attachments**
- id (TEXT, PRIMARY KEY)
- idea_id (TEXT, FOREIGN KEY)
- filename (TEXT, NOT NULL)
- original_name (TEXT, NOT NULL)
- mimetype (TEXT)
- size (INTEGER)
- created_at (DATETIME)

## License

MIT