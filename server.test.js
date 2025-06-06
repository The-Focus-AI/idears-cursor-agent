const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('./server');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATA_DIR = './test-data';

// Clean up test data before and after tests
beforeAll(() => {
  const testDataDir = './test-data';
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }
});

afterAll(() => {
  // Clean up test data
  const testDataDir = './test-data';
  if (fs.existsSync(testDataDir)) {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }
});

describe('Ideas API', () => {
  let createdIdeaId;

  describe('POST /api/ideas', () => {
    it('should create a new idea with title and description', async () => {
      const ideaData = {
        title: 'Test Idea',
        description: 'This is a test idea description'
      };

      const response = await request(app)
        .post('/api/ideas')
        .send(ideaData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(ideaData.title);
      expect(response.body.description).toBe(ideaData.description);
      expect(response.body.votes).toBe(0);
      
      createdIdeaId = response.body.id;
    });

    it('should create a new idea with only title', async () => {
      const ideaData = {
        title: 'Minimal Test Idea'
      };

      const response = await request(app)
        .post('/api/ideas')
        .send(ideaData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(ideaData.title);
      expect(response.body.description).toBe('');
    });

    it('should reject idea without title', async () => {
      const ideaData = {
        description: 'Description without title'
      };

      const response = await request(app)
        .post('/api/ideas')
        .send(ideaData)
        .expect(400);

      expect(response.body.error).toBe('Title is required');
    });

    it('should trim whitespace from title and description', async () => {
      const ideaData = {
        title: '  Whitespace Test  ',
        description: '  Description with spaces  '
      };

      const response = await request(app)
        .post('/api/ideas')
        .send(ideaData)
        .expect(201);

      expect(response.body.title).toBe('Whitespace Test');
      expect(response.body.description).toBe('Description with spaces');
    });
  });

  describe('GET /api/ideas', () => {
    it('should return all ideas sorted by votes', async () => {
      // Create ideas with different vote counts
      const idea1 = await request(app)
        .post('/api/ideas')
        .send({ title: 'Low Vote Idea' });
      
      const idea2 = await request(app)
        .post('/api/ideas')
        .send({ title: 'High Vote Idea' });

      // Vote for the second idea multiple times
      await request(app).post(`/api/ideas/${idea2.body.id}/vote`);
      await request(app).post(`/api/ideas/${idea2.body.id}/vote`);

      const response = await request(app)
        .get('/api/ideas')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
      
      // Check that ideas are sorted by votes (descending)
      const highVoteIdeaIndex = response.body.findIndex(i => i.id === idea2.body.id);
      const lowVoteIdeaIndex = response.body.findIndex(i => i.id === idea1.body.id);
      expect(highVoteIdeaIndex).toBeLessThan(lowVoteIdeaIndex);
    });

    it('should include note and attachment counts', async () => {
      const response = await request(app)
        .get('/api/ideas')
        .expect(200);

      response.body.forEach(idea => {
        expect(idea).toHaveProperty('note_count');
        expect(idea).toHaveProperty('attachment_count');
      });
    });
  });

  describe('GET /api/ideas/:id', () => {
    it('should return a single idea with notes and attachments', async () => {
      const response = await request(app)
        .get(`/api/ideas/${createdIdeaId}`)
        .expect(200);

      expect(response.body.id).toBe(createdIdeaId);
      expect(response.body).toHaveProperty('notes');
      expect(response.body).toHaveProperty('attachments');
      expect(Array.isArray(response.body.notes)).toBe(true);
      expect(Array.isArray(response.body.attachments)).toBe(true);
    });

    it('should return 404 for non-existent idea', async () => {
      const response = await request(app)
        .get('/api/ideas/non-existent-id')
        .expect(404);

      expect(response.body.error).toBe('Idea not found');
    });
  });

  describe('POST /api/ideas/:id/vote', () => {
    it('should increment vote count', async () => {
      const ideaBefore = await request(app)
        .get(`/api/ideas/${createdIdeaId}`);
      
      const initialVotes = ideaBefore.body.votes;

      const response = await request(app)
        .post(`/api/ideas/${createdIdeaId}/vote`)
        .expect(200);

      expect(response.body.votes).toBe(initialVotes + 1);
    });

    it('should return 404 for voting on non-existent idea', async () => {
      const response = await request(app)
        .post('/api/ideas/non-existent-id/vote')
        .expect(404);

      expect(response.body.error).toBe('Idea not found');
    });
  });

  describe('POST /api/ideas/:id/notes', () => {
    let noteId;

    it('should add a note to an idea', async () => {
      const noteData = {
        content: 'This is a test note'
      };

      const response = await request(app)
        .post(`/api/ideas/${createdIdeaId}/notes`)
        .send(noteData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.content).toBe(noteData.content);
      expect(response.body.idea_id).toBe(createdIdeaId);
      
      noteId = response.body.id;
    });

    it('should reject empty note content', async () => {
      const noteData = {
        content: ''
      };

      const response = await request(app)
        .post(`/api/ideas/${createdIdeaId}/notes`)
        .send(noteData)
        .expect(400);

      expect(response.body.error).toBe('Note content is required');
    });

    it('should trim whitespace from note content', async () => {
      const noteData = {
        content: '  Note with whitespace  '
      };

      const response = await request(app)
        .post(`/api/ideas/${createdIdeaId}/notes`)
        .send(noteData)
        .expect(201);

      expect(response.body.content).toBe('Note with whitespace');
    });

    it('should include notes when fetching idea details', async () => {
      const response = await request(app)
        .get(`/api/ideas/${createdIdeaId}`)
        .expect(200);

      expect(response.body.notes.length).toBeGreaterThan(0);
      const note = response.body.notes.find(n => n.id === noteId);
      expect(note).toBeDefined();
      expect(note.content).toBe('This is a test note');
    });
  });

  describe('POST /api/ideas/:id/attachments', () => {
    it('should upload a file attachment', async () => {
      const testFilePath = path.join(__dirname, 'test-file.txt');
      fs.writeFileSync(testFilePath, 'Test file content');

      const response = await request(app)
        .post(`/api/ideas/${createdIdeaId}/attachments`)
        .attach('file', testFilePath)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.original_name).toBe('test-file.txt');
      expect(response.body.idea_id).toBe(createdIdeaId);
      expect(response.body).toHaveProperty('filename');
      expect(response.body).toHaveProperty('size');
      expect(response.body).toHaveProperty('mimetype');

      // Clean up test file
      fs.unlinkSync(testFilePath);
    });

    it('should reject request without file', async () => {
      const response = await request(app)
        .post(`/api/ideas/${createdIdeaId}/attachments`)
        .expect(400);

      expect(response.body.error).toBe('No file uploaded');
    });

    it('should include attachments when fetching idea details', async () => {
      const response = await request(app)
        .get(`/api/ideas/${createdIdeaId}`)
        .expect(200);

      expect(response.body.attachments.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/attachments/:id/download', () => {
    it('should download an attachment', async () => {
      // First, get the idea with attachments
      const ideaResponse = await request(app)
        .get(`/api/ideas/${createdIdeaId}`);
      
      const attachment = ideaResponse.body.attachments[0];
      expect(attachment).toBeDefined();

      const response = await request(app)
        .get(`/api/attachments/${attachment.id}/download`)
        .expect(200);

      expect(response.headers['content-disposition']).toContain(attachment.original_name);
    });

    it('should return 404 for non-existent attachment', async () => {
      const response = await request(app)
        .get('/api/attachments/non-existent-id/download')
        .expect(404);

      expect(response.body.error).toBe('Attachment not found');
    });
  });
});

describe('Static file serving', () => {
  it('should serve the index.html file', async () => {
    const response = await request(app)
      .get('/')
      .expect(200);

    expect(response.headers['content-type']).toContain('text/html');
  });
});