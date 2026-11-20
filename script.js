"use strict";

const storageKey = "books";
const form = document.querySelector("#book-form");
const titleField = document.querySelector("#title");
const authorField = document.querySelector("#author");
const status = document.querySelector("#status");
const toReadList = document.querySelector("#to-read");
const readingList = document.querySelector("#reading");
const readList = document.querySelector("#read");
const toReadEmpty = document.querySelector("#to-read-empty");
const readingEmpty = document.querySelector("#reading-empty");
const readEmpty = document.querySelector("#read-empty");

let books = [];
try {
  const savedBooks = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
  if (!Array.isArray(savedBooks)) {
    throw new Error("Invalid book list");
  }
  books = savedBooks;
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

function addRatingControl(item, book, index) {
  const rating = document.createElement("select");
  rating.setAttribute("aria-label", `Оценка книги «${book.title}»`);
  const placeholder = new Option("Без оценки", "");
  placeholder.disabled = true;
  rating.add(placeholder);
  for (let score = 1; score <= 5; score++) {
    rating.add(new Option(`${score} из 5`, String(score)));
  }

  const savedRating = book.rating;
  rating.value = Number.isInteger(savedRating) && savedRating >= 1 && savedRating <= 5
    ? String(savedRating)
    : "";
  rating.addEventListener("change", () => {
    const score = Number(rating.value);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return;
    }
    if (updateBook(index, { rating: score })) {
      status.textContent = `Оценка книги «${book.title}» сохранена.`;
    } else {
      rating.value = String(books[index].rating ?? "");
    }
  });
  item.append(rating);
}

function addMoveButton(item, book, index, label, destination, sectionName) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.setAttribute("aria-label", `${label} книгу «${book.title}»`);
  button.addEventListener("click", () => {
    if (updateBook(index, { status: destination })) {
      renderBooks();
      status.textContent = `Книга «${book.title}» в разделе «${sectionName}».`;
      status.tabIndex = -1;
      status.focus();
    }
  });
  item.append(button);
}

function renderBooks() {
  toReadList.replaceChildren();
  readingList.replaceChildren();
  readList.replaceChildren();

  books.forEach((book, index) => {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = book.title;
    item.append(title);

    if (book.author) {
      const author = document.createElement("p");
      author.className = "author";
      author.textContent = book.author;
      item.append(author);
    }

    // Books saved before the reading section only have the read flag.
    const bookStatus = book.status ?? (book.read === true ? "read" : "to-read");
    if (bookStatus === "read") {
      addRatingControl(item, book, index);
      readList.append(item);
      return;
    }

    if (bookStatus !== "reading") {
      addMoveButton(item, book, index, "Начать читать", "reading", "Читаю");
    }
    addMoveButton(item, book, index, "Отметить прочитанной", "read", "Прочитано");
    const list = bookStatus === "reading" ? readingList : toReadList;
    list.append(item);
  });

  toReadEmpty.hidden = toReadList.childElementCount > 0;
  readingEmpty.hidden = readingList.childElementCount > 0;
  readEmpty.hidden = readList.childElementCount > 0;
}

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
  if (saveBooks([...books, { title, author, status: "to-read" }])) {
    form.reset();
    renderBooks();
    status.textContent = `Книга «${title}» добавлена.`;
    titleField.focus();
  }
});

renderBooks();
