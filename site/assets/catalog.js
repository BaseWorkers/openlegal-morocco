const search = document.querySelector('#catalog-search');
const category = document.querySelector('#category-filter');
const count = document.querySelector('#result-count');
const rows = [...document.querySelectorAll('[data-template]')];
const emptyState = document.querySelector('#empty-state');

function applyFilters() {
  const query = search.value.trim().toLocaleLowerCase();
  const selectedCategory = category.value;
  let visible = 0;
  for (const row of rows) {
    const matchesText = row.dataset.search.includes(query);
    const matchesCategory = !selectedCategory || row.dataset.categories.split(' ').includes(selectedCategory);
    const show = matchesText && matchesCategory;
    row.hidden = !show;
    if (show) visible += 1;
  }
  for (const section of document.querySelectorAll('[data-category-section]')) {
    section.hidden = !section.querySelector('[data-template]:not([hidden])');
  }
  count.textContent = `${visible} ${visible === 1 ? count.dataset.singular : count.dataset.plural}`;
  emptyState.hidden = visible !== 0;
}

search.addEventListener('input', applyFilters);
category.addEventListener('change', applyFilters);
applyFilters();
