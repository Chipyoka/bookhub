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