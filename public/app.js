// API base URL
const API_URL = '/api';

// DOM elements
const newIdeaForm = document.getElementById('new-idea-form');
const ideaTitle = document.getElementById('idea-title');
const ideaDescription = document.getElementById('idea-description');
const ideasList = document.getElementById('ideas-list');
const modal = document.getElementById('idea-modal');
const modalBody = document.getElementById('modal-body');
const closeModal = document.querySelector('.close');

// State
let ideas = [];
let currentIdeaId = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadIdeas();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    newIdeaForm.addEventListener('submit', handleSubmitIdea);
    closeModal.addEventListener('click', () => closeIdeaModal());
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeIdeaModal();
    });
}

// Load all ideas
async function loadIdeas() {
    try {
        const response = await fetch(`${API_URL}/ideas`);
        if (!response.ok) throw new Error('Failed to load ideas');
        
        ideas = await response.json();
        renderIdeas();
    } catch (error) {
        console.error('Error loading ideas:', error);
        showError('Failed to load ideas. Please try again.');
    }
}

// Render ideas list
function renderIdeas() {
    if (ideas.length === 0) {
        ideasList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💭</div>
                <div class="empty-state-text">No ideas yet. Be the first to share one!</div>
            </div>
        `;
        return;
    }

    ideasList.innerHTML = ideas.map(idea => `
        <div class="idea-card" data-id="${idea.id}">
            <div class="idea-header">
                <h3 class="idea-title">${escapeHtml(idea.title)}</h3>
                <div class="vote-section">
                    <button class="vote-btn" onclick="voteIdea('${idea.id}', event)">
                        <span>👍</span>
                        <span>Vote</span>
                    </button>
                    <span class="vote-count">${idea.votes}</span>
                </div>
            </div>
            ${idea.description ? `<p class="idea-description">${escapeHtml(idea.description)}</p>` : ''}
            <div class="idea-meta">
                <span>💬 ${idea.note_count || 0} notes</span>
                <span>📎 ${idea.attachment_count || 0} attachments</span>
                <span>📅 ${formatDate(idea.created_at)}</span>
            </div>
        </div>
    `).join('');

    // Add click handlers to idea cards
    document.querySelectorAll('.idea-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.vote-btn')) {
                openIdeaModal(card.dataset.id);
            }
        });
    });
}

// Handle new idea submission
async function handleSubmitIdea(e) {
    e.preventDefault();
    
    const submitButton = newIdeaForm.querySelector('button[type="submit"]');
    const btnText = submitButton.querySelector('.btn-text');
    const btnLoader = submitButton.querySelector('.btn-loader');
    
    // Show loading state
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline';
    submitButton.disabled = true;

    try {
        const response = await fetch(`${API_URL}/ideas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: ideaTitle.value.trim(),
                description: ideaDescription.value.trim()
            })
        });

        if (!response.ok) throw new Error('Failed to create idea');

        // Clear form
        ideaTitle.value = '';
        ideaDescription.value = '';

        // Reload ideas
        await loadIdeas();

        showSuccess('Idea submitted successfully!');
    } catch (error) {
        console.error('Error submitting idea:', error);
        showError('Failed to submit idea. Please try again.');
    } finally {
        // Reset button state
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
        submitButton.disabled = false;
    }
}

// Vote for an idea
async function voteIdea(ideaId, event) {
    event.stopPropagation();
    
    try {
        const response = await fetch(`${API_URL}/ideas/${ideaId}/vote`, {
            method: 'POST'
        });

        if (!response.ok) throw new Error('Failed to vote');

        // Update the idea in our local state
        const updatedIdea = await response.json();
        const ideaIndex = ideas.findIndex(i => i.id === ideaId);
        if (ideaIndex !== -1) {
            ideas[ideaIndex] = { ...ideas[ideaIndex], votes: updatedIdea.votes };
            renderIdeas();
        }

        showSuccess('Vote recorded!');
    } catch (error) {
        console.error('Error voting:', error);
        showError('Failed to record vote. Please try again.');
    }
}

// Open idea modal
async function openIdeaModal(ideaId) {
    currentIdeaId = ideaId;
    modal.style.display = 'block';
    modalBody.innerHTML = '<div class="loading">Loading idea details</div>';

    try {
        const response = await fetch(`${API_URL}/ideas/${ideaId}`);
        if (!response.ok) throw new Error('Failed to load idea');

        const idea = await response.json();
        renderIdeaModal(idea);
    } catch (error) {
        console.error('Error loading idea:', error);
        modalBody.innerHTML = '<div class="error">Failed to load idea details.</div>';
    }
}

// Render idea modal content
function renderIdeaModal(idea) {
    modalBody.innerHTML = `
        <div class="modal-idea-header">
            <h2 class="modal-idea-title">${escapeHtml(idea.title)}</h2>
            <div class="modal-idea-votes">👍 ${idea.votes} votes</div>
        </div>
        
        ${idea.description ? `<p class="modal-idea-description">${escapeHtml(idea.description)}</p>` : ''}
        
        <!-- Notes Section -->
        <div class="notes-section">
            <h3>Notes</h3>
            <form class="note-form" onsubmit="addNote(event, '${idea.id}')">
                <input type="text" placeholder="Add a note..." required maxlength="500">
                <button type="submit" class="btn btn-primary">Add Note</button>
            </form>
            <div class="notes-list">
                ${idea.notes && idea.notes.length > 0 
                    ? idea.notes.map(note => `
                        <div class="note-item">
                            <div class="note-content">${escapeHtml(note.content)}</div>
                            <div class="note-date">${formatDate(note.created_at)}</div>
                        </div>
                    `).join('')
                    : '<p class="empty-message">No notes yet.</p>'
                }
            </div>
        </div>
        
        <!-- Attachments Section -->
        <div class="attachments-section">
            <h3>Attachments</h3>
            <form class="file-upload-form" onsubmit="uploadFile(event, '${idea.id}')">
                <div class="file-input-wrapper">
                    <label for="file-input" class="file-input-label">
                        Choose File
                    </label>
                    <input type="file" id="file-input" required>
                </div>
                <button type="submit" class="btn btn-primary">Upload</button>
            </form>
            <div class="attachments-list">
                ${idea.attachments && idea.attachments.length > 0
                    ? idea.attachments.map(att => `
                        <div class="attachment-item">
                            <div class="attachment-info">
                                <span class="attachment-icon">${getFileIcon(att.mimetype)}</span>
                                <div>
                                    <div class="attachment-name">${escapeHtml(att.original_name)}</div>
                                    <div class="attachment-size">${formatFileSize(att.size)}</div>
                                </div>
                            </div>
                            <a href="${API_URL}/attachments/${att.id}/download" 
                               class="btn btn-secondary download-btn">Download</a>
                        </div>
                    `).join('')
                    : '<p class="empty-message">No attachments yet.</p>'
                }
            </div>
        </div>
    `;
}

// Add note to idea
async function addNote(event, ideaId) {
    event.preventDefault();
    
    const form = event.target;
    const input = form.querySelector('input');
    const button = form.querySelector('button');
    
    button.disabled = true;
    button.textContent = 'Adding...';

    try {
        const response = await fetch(`${API_URL}/ideas/${ideaId}/notes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: input.value.trim()
            })
        });

        if (!response.ok) throw new Error('Failed to add note');

        input.value = '';
        await openIdeaModal(ideaId); // Reload modal
        showSuccess('Note added!');
    } catch (error) {
        console.error('Error adding note:', error);
        showError('Failed to add note. Please try again.');
    } finally {
        button.disabled = false;
        button.textContent = 'Add Note';
    }
}

// Upload file attachment
async function uploadFile(event, ideaId) {
    event.preventDefault();
    
    const form = event.target;
    const fileInput = document.getElementById('file-input');
    const button = form.querySelector('button[type="submit"]');
    
    if (!fileInput.files[0]) return;
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    
    button.disabled = true;
    button.textContent = 'Uploading...';

    try {
        const response = await fetch(`${API_URL}/ideas/${ideaId}/attachments`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Failed to upload file');

        fileInput.value = '';
        await openIdeaModal(ideaId); // Reload modal
        showSuccess('File uploaded!');
    } catch (error) {
        console.error('Error uploading file:', error);
        showError('Failed to upload file. Please try again.');
    } finally {
        button.disabled = false;
        button.textContent = 'Upload';
    }
}

// Close modal
function closeIdeaModal() {
    modal.style.display = 'none';
    currentIdeaId = null;
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
        if (diffHours === 0) {
            const diffMinutes = Math.floor(diffTime / (1000 * 60));
            return diffMinutes === 0 ? 'Just now' : `${diffMinutes}m ago`;
        }
        return `${diffHours}h ago`;
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else {
        return date.toLocaleDateString();
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(mimetype) {
    if (!mimetype) return '📄';
    if (mimetype.startsWith('image/')) return '🖼️';
    if (mimetype.startsWith('video/')) return '🎥';
    if (mimetype.startsWith('audio/')) return '🎵';
    if (mimetype.includes('pdf')) return '📑';
    if (mimetype.includes('zip') || mimetype.includes('compressed')) return '🗜️';
    if (mimetype.includes('word') || mimetype.includes('document')) return '📝';
    if (mimetype.includes('sheet') || mimetype.includes('excel')) return '📊';
    return '📄';
}

// Show success message
function showSuccess(message) {
    // You could implement a toast notification here
    console.log('Success:', message);
}

// Show error message
function showError(message) {
    // You could implement a toast notification here
    console.error('Error:', message);
    alert(message);
}