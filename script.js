// Initialize IndexedDB
let db;
const DBRequest = indexedDB.open('SmartELibraryDB', 1);

DBRequest.onupgradeneeded = (event) => {
    db = event.target.result;
    if (!db.objectStoreNames.contains('pdfs')) {
        db.createObjectStore('pdfs', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('annotations')) {
        db.createObjectStore('annotations', { keyPath: 'id', autoIncrement: true });
    }
};

DBRequest.onsuccess = (event) => {
    db = event.target.result;
};

// PDF Handling
let currentPDF = null;
let currentScale = 1.5;

document.getElementById('pdfUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const title = prompt('Enter document title:');
        const author = prompt('Enter author:');
        const tags = prompt('Enter tags (comma-separated):').split(',');

        const transaction = db.transaction('pdfs', 'readwrite');
        const store = transaction.objectStore('pdfs');
        store.add({
            id: Date.now(),
            title,
            author,
            tags: tags.map(tag => tag.trim()),
            file,
            uploaded: new Date()
        });

        renderPDF(file);
    }
});

// PDF Rendering
function renderPDF(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const pdfData = new Uint8Array(e.target.result);
        pdfjsLib.getDocument({ data: pdfData }).promise.then(pdf => {
            currentPDF = pdf;
            renderPage(1);
        });
    };
    reader.readAsArrayBuffer(file);
}

function renderPage(pageNumber) {
    const viewer = document.getElementById('pdfViewer');
    viewer.innerHTML = '';
    
    currentPDF.getPage(pageNumber).then(page => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const viewport = page.getViewport({ scale: currentScale });
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        page.render({ canvasContext: context, viewport });
        viewer.appendChild(canvas);
        document.getElementById('pageNum').textContent = `Page: ${pageNumber}`;
    });
}

// Search Functionality
document.getElementById('searchInput').addEventListener('input', function(e) {
    const searchTerm = e.target.value.toLowerCase();
    const transaction = db.transaction('pdfs', 'readonly');
    const store = transaction.objectStore('pdfs');
    const results = [];

    store.openCursor().onsuccess = function(e) {
        const cursor = e.target.result;
        if (cursor) {
            const { title, author, tags } = cursor.value;
            if (title.toLowerCase().includes(searchTerm) || 
               author.toLowerCase().includes(searchTerm) || 
               tags.some(tag => tag.toLowerCase().includes(searchTerm))) {
                results.push(cursor.value);
            }
            cursor.continue();
        } else {
            displayResults(results);
        }
    };
});

function displayResults(items) {
    const list = document.getElementById('libraryList');
    list.innerHTML = items.map(item => `
        <div class="book-item" data-id="${item.id}">
            <h3>${item.title}</h3>
            <p>${item.author}</p>
            <small>${item.tags.join(', ')}</small>
        </div>
    `).join('');
}

// Dark Mode Toggle
document.getElementById('toggleDarkMode').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
});

// Initialize Dark Mode
if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
}

// Zoom Controls
document.getElementById('zoomIn').addEventListener('click', () => {
    currentScale += 0.1;
    renderPage(1);
});

document.getElementById('zoomOut').addEventListener('click', () => {
    currentScale = Math.max(0.5, currentScale - 0.1);
    renderPage(1);
});

// Bookmark System
document.getElementById('addBookmark').addEventListener('click', () => {
    const currentPage = parseInt(document.getElementById('pageNum').textContent.split(': ')[1]);
    const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '{}');
    bookmarks[currentPDF._pdfInfo.fingerprint] = currentPage;
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
    alert('Bookmark saved!');
});

// Highlight System
let selectedText = '';
document.addEventListener('selectionchange', () => {
    selectedText = window.getSelection().toString();
});

document.getElementById('highlightBtn').addEventListener('click', () => {
    if (selectedText) {
        const transaction = db.transaction('annotations', 'readwrite');
        const store = transaction.objectStore('annotations');
        store.add({
            text: selectedText,
            date: new Date(),
            pdfId: currentPDF._pdfInfo.fingerprint
        });
        alert('Highlight saved!');
    }
});