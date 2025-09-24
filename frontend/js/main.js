const booksContainer = document.querySelector('.books');
const paginationContainer = document.querySelector('.pagination');

let currentPage = 1;
const limit = 10; // books per page

// --- Helper to format date ---
function daysBetween(date) {
  const now = new Date();
  const postedDate = new Date(date);
  const diffTime = Math.abs(now - postedDate);
  return diffTime / (1000 * 60 * 60 * 24); // days
}

// --- Fetch books from API with pagination ---
async function fetchBooks(page = 1) {
  try {
    const res = await fetch(`http://localhost:5000/api/books?page=${page}&limit=${limit}`);
    const data = await res.json();

    if (!data.success) {
      booksContainer.innerHTML = '<p>Failed to load books.</p>';
      return;
    }

    renderBooks(data.data);
    renderPagination(data.totalPages, page);
  } catch (err) {
    console.error('Error fetching books:', err);
    booksContainer.innerHTML = '<p>Error loading books.</p>';
  }
}

// --- Render books as cards ---
function renderBooks(books) {
  booksContainer.innerHTML = '';

  books.forEach(book => {
    const price = Number(book.price);
    const formattedPrice = isNaN(price) ? book.price : price.toFixed(2);
    const isNew = daysBetween(book.created_at) < 2 ? '<span class="badge">New</span>' : '';

    const bookCard = document.createElement('div');
    bookCard.className = 'book-card';
    bookCard.innerHTML = `
      <div class="image-container">
        <img src="${book.image_url}" alt="${book.title}" class="book-image">
      </div>
      <hr/>
      <div class="book-info">
        <h6>${isNew} Save 12%</h6>
        <h3 title="${book.title}">${book.title}</h3>
        <p class="author">By ${book.author}</p>
        <p class="price">K${formattedPrice}</p>
        <button onclick="viewBook(${book.id})">View Details</button>
      </div>
    `;
    booksContainer.appendChild(bookCard);
  });
}

// --- Render pagination controls ---
function renderPagination(totalPages, activePage) {
  paginationContainer.innerHTML = '';

  // Previous
  const prevBtn = document.createElement('button');
  prevBtn.textContent = 'Prev';
  prevBtn.disabled = activePage === 1;
  prevBtn.onclick = () => fetchBooks(activePage - 1);
  paginationContainer.appendChild(prevBtn);

  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    if (i === activePage) btn.classList.add('active-page');
    btn.onclick = () => fetchBooks(i);
    paginationContainer.appendChild(btn);
  }

  // Next
  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next';
  nextBtn.disabled = activePage === totalPages;
  nextBtn.onclick = () => fetchBooks(activePage + 1);
  paginationContainer.appendChild(nextBtn);
}

// --- Navigate to book details ---
function viewBook(bookId) {
  window.location.href = `view-details.html?id=${bookId}`;
}



// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => fetchBooks(currentPage));



    // Utility: get query parameter
    function getQueryParam(name) {
      const params = new URLSearchParams(window.location.search);
      return params.get(name);
    }

    // Fetch and display book details
    async function loadBookDetails() {
      const bookId = getQueryParam('id');
      if (!bookId) {
        document.querySelector('.book-details').innerHTML = '<p>Book ID is missing.</p>';
        return;
      }
      const backToListing = document.getElementById('back-to-list');
      backToListing.addEventListener('click', () =>{
        window.location.href = `products.html`;
      })

      try {
        const res = await fetch(`http://localhost:5000/api/books/${bookId}`);
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();

        if (!data.success || !data.data) {
          document.querySelector('.book-details').innerHTML = '<p>Book not found.</p>';
          return;
        }

        const book = data.data;
        document.getElementById('book-title').textContent = book.title;
        document.getElementById('book-author').textContent = book.author;
        document.getElementById('book-price').textContent = Number(book.price).toFixed(2);
        document.getElementById('book-description').textContent = book.description || 'No description available.';
        document.getElementById('book-image').src = book.image_url;
        document.getElementById('book-image').alt = book.title;
      } catch (err) {
        console.error('Error loading book details:', err);
        document.querySelector('.book-details').innerHTML = '<p>Error loading book details.</p>';
      }
    }

    // Initialize
    document.getElementById('year').textContent = new Date().getFullYear();
    document.addEventListener('DOMContentLoaded', loadBookDetails);



    
    document.addEventListener('DOMContentLoaded', () => {
      // Redirect to results page with the query
      document.getElementById('search-form').addEventListener('submit', function (e) {
        e.preventDefault();
        const query = document.getElementById('search-input').value.trim();
        if (query) {
          window.location.href = `search-results.html?q=${encodeURIComponent(query)}`;
        }
      });

  })