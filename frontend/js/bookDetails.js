// Utility: get query parameter
export function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// Fetch and display book details
export async function loadBookDetails() {
  const bookId = getQueryParam('id');
  if (!bookId) {
    document.querySelector('.book-details').innerHTML = '<p>Book ID is missing.</p>';
    return;
  }
  
  const backToListing = document.getElementById('back-to-list');
  backToListing.addEventListener('click', () => {
    window.location.href = `products.html`;
  });

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

// Initialize function
export function initBookDetails() {
  // document.getElementById('year').textContent = new Date().getFullYear();
  document.addEventListener('DOMContentLoaded', loadBookDetails);
}