// bestSellers.js
// Renders top-5 best sellers (or random) into a container with id="best-sellers"

export async function renderBestSellers() {
  const container = document.getElementById('best-sellers');
  if (!container) {
    console.log("Can't render best sellers, container not found");
    return
  };

  try {
    const res = await fetch('http://localhost:5000/api/books/best-sellers');
    const data = await res.json();

    if (!data.success || !data.data.length) {
      container.innerHTML = '<p>No books found.</p>';
      return;
    }

    container.innerHTML = ''; // clear existing content
    data.data.forEach(book => {
      const price = Number(book.price);
      const formattedPrice = isNaN(price) ? book.price : price.toFixed(2);

      const card = document.createElement('div');
      card.className = 'book-card';
      card.innerHTML = `
        <div class="image-container">
          <img src="${book.image_url}" alt="${book.title}" class="book-image">
        </div>
        <hr/>
        <div class="book-info">
          <h3 title="${book.title}">${book.title}</h3>
          <p class="author">By ${book.author}</p>
          <p class="price">K${formattedPrice}</p>
          <button class="view-details-btn" data-book-id="${book.id}">View Details</button>
        </div>
      `;
      container.appendChild(card);
    });

    // Wire up the View Details buttons
    container.querySelectorAll('.view-details-btn').forEach(btn =>
      btn.addEventListener('click', e =>
        window.location.href = `view-details.html?id=${e.target.dataset.bookId}`
      )
    );
  } catch (err) {
    console.error('Error fetching best sellers:', err);
    container.innerHTML = '<p>Error loading best sellers.</p>';
  }
}
