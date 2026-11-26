"use strict";

const storageKey = "books";
const form = document.querySelector("#book-form");
const titleField = document.querySelector("#title");
const authorField = document.querySelector("#author");
const typeField = document.querySelector("#book-type");
const status = document.querySelector("#status");
const viewOptions = document.querySelector("#view-options");
const typeFilter = document.querySelector("#filter-type");
const ratingFilter = document.querySelector("#filter-rating");
const statusFilter = document.querySelector("#filter-status");
const sortField = document.querySelector("#sort-books");
const noResults = document.querySelector("#no-results");
const shelves = document.querySelector(".shelves");
const sections = ["to-read", "reading", "read"].map((key) => {
  const list = document.getElementById(key);
  return { key, list, panel: list.parentElement, empty: document.getElementById(`${key}-empty`) };
});
const typeLabels = new Map();
for (const option of typeField.options) {
  if (option.value) {
    typeLabels.set(option.value, option.text);
    typeFilter.add(new Option(option.text, option.value));
  }
}

function loadBooks() {
  const savedBooks = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
  if (!Array.isArray(savedBooks)) {
    throw new Error("Invalid book list");
  }
  return savedBooks;
}

let books = [];
try {
  books = loadBooks();
} catch {
  status.textContent = "Не удалось загрузить список.";
}

function saveBooks(updatedBooks) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(updatedBooks));
  } catch {
    status.textContent = "Не удалось сохранить изменения.";
    return false;
  }
  books = updatedBooks;
  return true;
}

function updateBook(index, changes) {
  const updatedBooks = books.slice();
  updatedBooks[index] = { ...books[index], ...changes };
  return saveBooks(updatedBooks);
}

function getRating(book) {
  const score = book.rating;
  return Number.isInteger(score) && score >= 1 && score <= 5 ? score : null;
}

function announce(message) {
  status.textContent = message;
  status.tabIndex = -1;
  status.focus();
}

function addRatingControl(item, book, index) {
  const rating = document.createElement("select");
  rating.setAttribute("aria-label", `Оценка книги «${book.title}»`);
  const placeholder = new Option("Не оценено", "");
  placeholder.disabled = true;
  rating.add(placeholder);
  for (let score = 1; score <= 5; score++) {
    rating.add(new Option(`${score} из 5`, String(score)));
  }

  rating.value = String(getRating(book) ?? "");
  rating.addEventListener("change", () => {
    const score = Number(rating.value);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return;
    }
    if (updateBook(index, { rating: score })) {
      const updatedRating = renderBooks(index);
      const message = `Оценка книги «${book.title}» сохранена.`;
      if (updatedRating) {
        status.textContent = message;
        updatedRating.focus();
      } else {
        announce(message);
      }
    } else {
      rating.value = String(getRating(books[index]) ?? "");
    }
  });
  item.append(rating);
  return rating;
}

function addMoveButton(item, book, index, label, destination, sectionName) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.setAttribute("aria-label", `${label} книгу «${book.title}»`);
  button.addEventListener("click", () => {
    if (updateBook(index, { status: destination })) {
      renderBooks();
      announce(`Книга «${book.title}» в разделе «${sectionName}».`);
    }
  });
  item.append(button);
}

function addDeleteButton(heading, book, index) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "delete-book";
  button.textContent = "×";
  button.setAttribute("aria-label", `Удалить книгу «${book.title}»`);
  button.addEventListener("click", () => {
    if (!window.confirm(`Удалить книгу «${book.title}»?`)) {
      return;
    }

    const updatedBooks = books.slice();
    updatedBooks.splice(index, 1);
    if (saveBooks(updatedBooks)) {
      renderBooks();
      announce(`Книга «${book.title}» удалена.`);
    }
  });
  heading.append(button);
}

function renderBooks(focusedIndex) {
  const selectedType = typeFilter.value;
  const selectedRating = ratingFilter.value;
  const selectedStatus = statusFilter.value;
  const sort = sortField.value;
  const filtering = Boolean(selectedType || selectedRating || selectedStatus);
  const visibleBooks = books.map((book, index) => ({
    book,
    index,
    // Books saved before the reading section only have the read flag.
    key: book.status ?? (book.read === true ? "read" : "to-read"),
    type: typeLabels.has(book.type) ? book.type : "unspecified",
    score: getRating(book),
  })).filter(({ key, type, score }) =>
    (!selectedStatus || selectedStatus === key) &&
    (!selectedType || selectedType === type) &&
    (!selectedRating || selectedRating === (score === null ? "unrated" : String(score)))
  );

  if (sort === "type") {
    visibleBooks.sort((a, b) => {
      const aLabel = typeLabels.get(a.type);
      const bLabel = typeLabels.get(b.type);
      if (!aLabel || !bLabel) {
        return Number(!aLabel) - Number(!bLabel);
      }
      return aLabel.localeCompare(bLabel, "ru");
    });
  } else if (sort === "rating-desc" || sort === "rating-asc") {
    const direction = sort === "rating-desc" ? -1 : 1;
    visibleBooks.sort((a, b) => {
      if (a.score === null || b.score === null) {
        return Number(a.score === null) - Number(b.score === null);
      }
      return (a.score - b.score) * direction;
    });
  }

  const orderedSections = sort === "status" ? [...sections].reverse() : sections;
  for (const { key, list, panel } of orderedSections) {
    list.replaceChildren();
    panel.hidden = Boolean(selectedStatus && selectedStatus !== key);
  }
  if (shelves.firstElementChild !== orderedSections[0].panel) {
    shelves.append(...orderedSections.map(({ panel }) => panel));
  }

  let focusedRating;
  for (const { book, index, key, type } of visibleBooks) {
    const item = document.createElement("li");
    const heading = document.createElement("div");
    heading.className = "book-heading";
    const title = document.createElement("strong");
    title.textContent = book.title;
    heading.append(title);
    addDeleteButton(heading, book, index);
    item.append(heading);

    if (book.author) {
      const author = document.createElement("p");
      author.className = "author";
      author.textContent = book.author;
      item.append(author);
    }

    const typeLabel = document.createElement("p");
    typeLabel.className = "book-type";
    typeLabel.textContent = typeLabels.get(type) ?? "Тип не указан";
    item.append(typeLabel);

    if (key === "read") {
      const rating = addRatingControl(item, book, index);
      if (index === focusedIndex) {
        focusedRating = rating;
      }
      addMoveButton(item, book, index, "В раздел «Читаю»", "reading", "Читаю");
    } else {
      if (key !== "reading") {
        addMoveButton(item, book, index, "Начать читать", "reading", "Читаю");
      }
      addMoveButton(item, book, index, "Отметить прочитанной", "read", "Прочитано");
    }
    if (key !== "to-read") {
      addMoveButton(item, book, index, "В раздел «Хочу прочитать»", "to-read", "Хочу прочитать");
    }
    const { list } = sections.find((section) => section.key === key) ?? sections[0];
    list.append(item);
  }

  for (const { list, empty } of sections) {
    empty.hidden = filtering || list.childElementCount > 0;
  }
  noResults.hidden = !filtering || visibleBooks.length > 0;
  return focusedRating;
}

viewOptions.addEventListener("change", () => renderBooks());
viewOptions.addEventListener("reset", () => queueMicrotask(() => renderBooks()));

titleField.addEventListener("input", () => {
  titleField.setCustomValidity("");
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = titleField.value.trim();
  if (!title) {
    titleField.setCustomValidity("Введите название книги.");
    titleField.reportValidity();
    return;
  }

  const author = authorField.value.trim();
  const type = typeField.value;
  let savedBooks;
  try {
    savedBooks = loadBooks();
  } catch {
    status.textContent = "Не удалось загрузить список.";
    return;
  }
  if (saveBooks([...savedBooks, { title, author, type, status: "to-read" }])) {
    form.reset();
    renderBooks();
    status.textContent = `Книга «${title}» добавлена.`;
    titleField.focus();
  }
});

renderBooks();
