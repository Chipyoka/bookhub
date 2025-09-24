// main.js
import { initBookDetails } from './bookDetails.js';
import { renderBestSellers } from './bestSellers.js';

// --- Initialize Book Details if that page is loaded ---
initBookDetails();

// ---- Element references (may be null on some pages) ----
const booksContainer = document.querySelector('.books');
const paginationContainer = document.querySelector('.pagination');
const tabsContainer = document.querySelector('.filters');

let currentPage = 1;
let currentCategory = 'all';
const limit = 10;

// --- Category definitions ---
const categories = [
  { key: 'all', label: 'All' },
  { key: 'latest', label: 'Latest' },
  { key: 'Devotionals', label: 'Devotionals' },
  { key: 'Christian Living', label: 'Christian Living' },
  { key: 'Bible Studies', label: 'Bible Studies' },
  { key: 'Inspirational Fiction', label: 'Inspirational' },
  { key: 'Memoirs and Testimonies', label: 'Testimonies' }
];

// ---- Category Tabs ----
function renderCategoryTabs() {
  if (!tabsContainer) return; // not on a page with filters

  const tabsWrapper = document.createElement('div');
  tabsWrapper.className = 'category-tabs';

  categories.forEach(cat => {
    const tab = document.createElement('button');
    tab.className = 'category-tab';
    tab.textContent = cat.label;
    tab.dataset.category = cat.key;
    if (cat.key === currentCategory) tab.classList.add('active');

    tab.addEventListener('click', () => {
      currentCategory = cat.key;
      currentPage = 1;
      tabsWrapper.querySelectorAll('.category-tab').forEach(btn => btn.classList.remove('active'));
      tab.classList.add('active');
      fetchBooks(currentPage, currentCategory);
    });

    tabsWrapper.appendChild(tab);
  });

  tabsContainer.appendChild(tabsWrapper);
}

// ---- Helper ----
function daysBetween(date) {
  const now = new Date();
  const posted = new Date(date);
  return Math.abs(now - posted) / (1000 * 60 * 60 * 24);
}

// ---- Fetch & Render Books ----
async function fetchBooks(page = 1, category = currentCategory) {
  if (!booksContainer) return; // not a listing page

  try {
    let url = `http://localhost:5000/api/books?page=${page}&limit=${limit}`;
    if (category === 'latest') url += '&sort=latest';
    else if (category !== 'all') url += `&category=${encodeURIComponent(category)}`;

    const res = await fetch(url);
    const data = await res.json();

    if (!data.success) {
      booksContainer.innerHTML = '<p>Failed to load books.</p>';
      return;
    }

    renderBooks(data.data);
    renderPagination(data.totalPages || 1, page);
  } catch (err) {
    console.error('Error fetching books:', err);
    booksContainer.innerHTML = '<p>Error loading books.</p>';
  }
}

function renderBooks(books) {
  if (!booksContainer) return;
  booksContainer.innerHTML = '';

  books.forEach(book => {
    const price = Number(book.price);
    const formattedPrice = isNaN(price) ? book.price : price.toFixed(2);
    const isNew = daysBetween(book.created_at) < 2 ? '<span class="badge">New</span>' : '';

    const card = document.createElement('div');
    card.className = 'book-card';
    card.innerHTML = `
      <div class="image-container">
        <img src="${book.image_url}" alt="${book.title}" class="book-image">
      </div>
      <hr/>
      <div class="book-info">
        <h6>${isNew} Save 16%</h6>
        <h3 title="${book.title}">${book.title}</h3>
        <p class="author">By ${book.author}</p>
        <p class="price">K${formattedPrice}</p>
        <button class="view-details-btn" data-book-id="${book.id}">View Details</button>
      </div>
    `;
    booksContainer.appendChild(card);
  });

  document.querySelectorAll('.view-details-btn').forEach(btn =>
    btn.addEventListener('click', e => viewBook(e.target.dataset.bookId))
  );
}

function renderPagination(totalPages, activePage) {
  if (!paginationContainer) return;
  paginationContainer.innerHTML = '';

  const prevBtn = document.createElement('button');
  prevBtn.textContent = 'Prev';
  prevBtn.disabled = activePage === 1;
  prevBtn.addEventListener('click', () => {
    currentPage = activePage - 1;
    fetchBooks(currentPage, currentCategory);
  });
  paginationContainer.appendChild(prevBtn);

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    if (i === activePage) btn.classList.add('active-page');
    btn.addEventListener('click', () => {
      currentPage = i;
      fetchBooks(currentPage, currentCategory);
    });
    paginationContainer.appendChild(btn);
  }

  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next';
  nextBtn.disabled = activePage === totalPages;
  nextBtn.addEventListener('click', () => {
    currentPage = activePage + 1;
    fetchBooks(currentPage, currentCategory);
  });
  paginationContainer.appendChild(nextBtn);
}

function viewBook(bookId) {
  window.location.href = `view-details.html?id=${bookId}`;
}

// ---- Initialize only when elements exist ----
function initMainPage() {
  if (tabsContainer && booksContainer && paginationContainer) {
    renderCategoryTabs();
    fetchBooks(currentPage, currentCategory);
  }
}

// ---- Always render best sellers ----
document.addEventListener('DOMContentLoaded', () => {
  initMainPage();
  renderBestSellers(); // works on any page
});
