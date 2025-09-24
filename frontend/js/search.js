// search.js
document.addEventListener('DOMContentLoaded', () => {
  /** -------------------------
   * Header search form (global)
   * ------------------------- */
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');

  if (searchForm && searchInput) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const query = searchInput.value.trim();
      if (query) {
        // redirect to results page
        window.location.href = `search-results.html?q=${encodeURIComponent(query)}`;
      }
    });
  }

  /** -------------------------
   *  Results page logic
   * ------------------------- */
  const resultsContainer = document.getElementById('results-container');
  const yearEl = document.getElementById('year');

  // set footer year if element exists
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  if (resultsContainer) {
    // Only run if we're on the search-results page
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');

    if (!query) {
      resultsContainer.innerHTML = '<p>No search query provided.</p>';
      return;
    }

    fetchSearchResults(query);
  }

  /** -------------------------
   * Helper: Fetch & Render
   * ------------------------- */
  async function fetchSearchResults(query) {
    try {
      // Backend endpoint should search title OR author by keyword
      const res = await fetch(
        `http://localhost:5000/api/books/search?q=${encodeURIComponent(query)}`
      );
      const data = await res.json();

      if (!data.success || !data.data.length) {
        resultsContainer.innerHTML =
          `<p>No results found for "<strong>${query}</strong>".</p>`;
        return;
      }

      resultsContainer.innerHTML = ''; // clear old results
      data.data.forEach(book => {
        const price = Number(book.price);
        const formattedPrice = isNaN(price) ? book.price : price.toFixed(2);

        const card = document.createElement('div');
        card.className = 'book-card';
        card.innerHTML = `
          <div class="image-container">
            <img src="${book.image_url}" alt="${book.title}" class="book-image">
          </div>
          <div class="book-info">
            <h3>${book.title}</h3>
            <p class="author">By ${book.author}</p>
            <p class="price">K${formattedPrice}</p>
            <button class="view-details-btn" data-id="${book.id}">View Details</button>
          </div>
        `;
        resultsContainer.appendChild(card);
      });

      // Attach event listeners for each detail button
      resultsContainer.querySelectorAll('.view-details-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          const id = e.currentTarget.dataset.id;
          window.location.href = `view-details.html?id=${id}`;
        });
      });
    } catch (err) {
      console.error('Error fetching search results:', err);
      resultsContainer.innerHTML = '<p>Error retrieving search results.</p>';
    }
  }
});
