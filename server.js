const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Create directories if they don't exist
const dataDir = process.env.DATA_DIR || './data';
const uploadsDir = path.join(dataDir, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Database setup
const dbPath = path.join(dataDir, 'ideas.db');
const db = new sqlite3.Database(dbPath);

// Initialize database schema
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS ideas (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      votes INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      idea_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      idea_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mimetype TEXT,
      size INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE
    )
  `);
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Routes

// Get all ideas sorted by votes
app.get('/api/ideas', (req, res) => {
  db.all(
    `SELECT i.*, COUNT(DISTINCT n.id) as note_count, COUNT(DISTINCT a.id) as attachment_count
     FROM ideas i
     LEFT JOIN notes n ON i.id = n.idea_id
     LEFT JOIN attachments a ON i.id = a.idea_id
     GROUP BY i.id
     ORDER BY i.votes DESC, i.created_at DESC`,
    (err, ideas) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(ideas);
    }
  );
});

// Get single idea with notes and attachments
app.get('/api/ideas/:id', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM ideas WHERE id = ?', [id], (err, idea) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!idea) {
      res.status(404).json({ error: 'Idea not found' });
      return;
    }

    db.all('SELECT * FROM notes WHERE idea_id = ? ORDER BY created_at DESC', [id], (err, notes) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      db.all('SELECT * FROM attachments WHERE idea_id = ? ORDER BY created_at DESC', [id], (err, attachments) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        res.json({ ...idea, notes, attachments });
      });
    });
  });
});

// Create new idea
app.post('/api/ideas', (req, res) => {
  const { title, description } = req.body;
  const id = uuidv4();

  if (!title || title.trim() === '') {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  db.run(
    'INSERT INTO ideas (id, title, description) VALUES (?, ?, ?)',
    [id, title.trim(), description ? description.trim() : ''],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      db.get('SELECT * FROM ideas WHERE id = ?', [id], (err, idea) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.status(201).json(idea);
      });
    }
  );
});

// Vote on an idea
app.post('/api/ideas/:id/vote', (req, res) => {
  const { id } = req.params;

  db.run(
    'UPDATE ideas SET votes = votes + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Idea not found' });
        return;
      }

      db.get('SELECT * FROM ideas WHERE id = ?', [id], (err, idea) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json(idea);
      });
    }
  );
});

// Add note to idea
app.post('/api/ideas/:id/notes', (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  const noteId = uuidv4();

  if (!content || content.trim() === '') {
    res.status(400).json({ error: 'Note content is required' });
    return;
  }

  db.run(
    'INSERT INTO notes (id, idea_id, content) VALUES (?, ?, ?)',
    [noteId, id, content.trim()],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      db.get('SELECT * FROM notes WHERE id = ?', [noteId], (err, note) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.status(201).json(note);
      });
    }
  );
});

// Upload attachment to idea
app.post('/api/ideas/:id/attachments', upload.single('file'), (req, res) => {
  const { id } = req.params;
  const file = req.file;

  if (!file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const attachmentId = uuidv4();

  db.run(
    'INSERT INTO attachments (id, idea_id, filename, original_name, mimetype, size) VALUES (?, ?, ?, ?, ?, ?)',
    [attachmentId, id, file.filename, file.originalname, file.mimetype, file.size],
    function(err) {
      if (err) {
        // Clean up uploaded file on error
        fs.unlinkSync(file.path);
        res.status(500).json({ error: err.message });
        return;
      }

      db.get('SELECT * FROM attachments WHERE id = ?', [attachmentId], (err, attachment) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.status(201).json(attachment);
      });
    }
  );
});

// Download attachment
app.get('/api/attachments/:id/download', (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM attachments WHERE id = ?', [id], (err, attachment) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!attachment) {
      res.status(404).json({ error: 'Attachment not found' });
      return;
    }

    const filePath = path.join(uploadsDir, attachment.filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    res.download(filePath, attachment.original_name);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;