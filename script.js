"use strict";

const storageKey = "books";
const backupVersion = 1;
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

function parseStoredBooks(stored) {
  const savedBooks = JSON.parse(stored ?? "[]");
  if (!Array.isArray(savedBooks)) {
    throw new Error("Invalid book list");
  }
  return savedBooks;
}

function loadBooks() {
  return parseStoredBooks(localStorage.getItem(storageKey));
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
  let updatedBooks;
  try {
    updatedBooks = loadBooks();
  } catch {
    announce("Не удалось загрузить текущий список.");
    return false;
  }

  // Appended books preserve the indexes used by the current cards.
  if (JSON.stringify(updatedBooks.slice(0, books.length)) !== JSON.stringify(books)) {
    books = updatedBooks;
    renderBooks();
    announce("Список изменился в другой вкладке. Повторите действие.");
    return false;
  }

  updatedBooks[index] = { ...updatedBooks[index], ...changes };
  return saveBooks(updatedBooks);
}

function getRating(book) {
  const score = book.rating;
  return Number.isInteger(score) && score >= 1 && score <= 5 ? score : null;
}

function getBookStatus(book) {
  // Books saved before the reading section only have the read flag.
  return book.status ?? (book.read === true ? "read" : "to-read");
}

function announce(message) {
  status.textContent = message;
  status.tabIndex = -1;
  status.focus();
}

function addTypeControl(item, book, index) {
  const select = document.createElement("select");
  select.setAttribute("aria-label", `Тип книги «${book.title}»`);
  const unspecified = new Option("Тип не указан", "");
  unspecified.disabled = true;
  select.add(unspecified);
  for (const [value, label] of typeLabels) {
    select.add(new Option(label, value));
  }
  const currentType = typeLabels.has(book.type) ? book.type : "";
  select.value = currentType;
  select.addEventListener("change", () => {
    if (!updateBook(index, { type: select.value })) {
      select.value = currentType;
      return;
    }
    const updatedControl = renderBooks(index, "type");
    const message = `Тип книги «${book.title}» сохранён.`;
    if (updatedControl) {
      status.textContent = message;
      updatedControl.focus();
    } else {
      announce(message);
    }
  });
  item.append(select);
  return select;
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
      rating.value = String(getRating(book) ?? "");
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

function renderBooks(focusedIndex, control = "rating") {
  const selectedType = typeFilter.value;
  const selectedRating = ratingFilter.value;
  const selectedStatus = statusFilter.value;
  const sort = sortField.value;
  const filtering = Boolean(selectedType || selectedRating || selectedStatus);
  const visibleBooks = books.map((book, index) => ({
    book,
    index,
    key: getBookStatus(book),
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

  let focusedControl;
  for (const { book, index, key } of visibleBooks) {
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

    const typeControl = addTypeControl(item, book, index);
    if (index === focusedIndex && control === "type") {
      focusedControl = typeControl;
    }

    if (key === "read") {
      const rating = addRatingControl(item, book, index);
      if (index === focusedIndex && control === "rating") {
        focusedControl = rating;
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
  return focusedControl;
}

document.querySelector("#download-backup").addEventListener("click", () => {
  let savedBooks;
  try {
    savedBooks = loadBooks();
  } catch {
    announce("Не удалось скачать копию списка.");
    return;
  }

  const contents = JSON.stringify({ version: backupVersion, books: savedBooks }, null, 2);
  const file = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = "spisok-backup.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

function isBackupBook(book) {
  return book !== null && typeof book === "object" &&
    typeof book.title === "string" && Boolean(book.title.trim()) &&
    (book.author === undefined || typeof book.author === "string") &&
    (book.type === undefined || book.type === "" || typeLabels.has(book.type)) &&
    (book.status === undefined || sections.some(({ key }) => key === book.status)) &&
    (book.read === undefined || typeof book.read === "boolean") &&
    (book.rating == null || getRating(book) !== null);
}

const backupFile = document.querySelector("#backup-file");
const backupPreview = document.querySelector("#backup-preview");
const backupMatches = document.querySelector("#backup-matches");
const backupMatchOptions = document.querySelector("#backup-match-options");
const addFromBackup = document.querySelector("#add-from-backup");
const replaceFromBackup = document.querySelector("#replace-from-backup");
let previewRequest = 0;
let previewBooks = [];
const matchChoices = new Map();

function bookMatchKey(book) {
  const normalize = (text) => text.trim().toLocaleLowerCase("ru");
  return JSON.stringify([normalize(book.title), normalize(book.author ?? "")]);
}

function findBackupMatches(currentBooks) {
  const seen = new Set(currentBooks.map(bookMatchKey));
  const matches = [];
  previewBooks.forEach((book, index) => {
    const key = bookMatchKey(book);
    if (seen.has(key)) {
      matches.push(index);
    }
    seen.add(key);
  });
  return matches;
}

function showBackupMatches(matches) {
  const selected = new Set([...matchChoices].filter(([, input]) => input.checked).map(([index]) => index));
  matchChoices.clear();
  backupMatchOptions.replaceChildren();
  backupMatches.hidden = matches.length === 0;
  for (const index of matches) {
    const book = previewBooks[index];
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = selected.has(index);
    const text = document.createElement("span");
    const section = document.getElementById(`${getBookStatus(book)}-heading`);
    text.textContent = [book.title, book.author, typeLabels.get(book.type), section.textContent]
      .filter(Boolean).join(" — ");
    const label = document.createElement("label");
    label.append(input, text);
    backupMatchOptions.append(label);
    matchChoices.set(index, input);
  }
}

function clearBackupPreview() {
  previewBooks = [];
  showBackupMatches([]);
  addFromBackup.hidden = true;
  replaceFromBackup.hidden = true;
  backupPreview.hidden = true;
}

document.querySelector("#choose-backup").addEventListener("click", () => backupFile.click());
backupFile.addEventListener("change", async () => {
  const file = backupFile.files[0];
  if (!file) {
    return;
  }
  backupFile.value = "";
  const request = ++previewRequest;
  clearBackupPreview();
  backupPreview.hidden = false;
  backupPreview.textContent = "Читаем копию…";

  let message;
  let validBooks;
  try {
    const backup = JSON.parse(await file.text());
    if (backup?.version !== backupVersion) {
      message = "Неподдерживаемый формат копии.";
    } else if (!Array.isArray(backup.books) || !backup.books.every(isBackupBook)) {
      message = "В копии есть некорректные данные.";
    } else {
      const counts = { "to-read": 0, reading: 0, read: 0 };
      for (const book of backup.books) {
        counts[getBookStatus(book)]++;
      }
      message = `Всего книг: ${backup.books.length}. Хочу прочитать: ${counts["to-read"]}. Читаю: ${counts.reading}. Прочитано: ${counts.read}.`;
      validBooks = backup.books;
    }
  } catch {
    message = "Не удалось прочитать копию.";
  }
  if (request === previewRequest) {
    backupPreview.textContent = message;
    if (validBooks) {
      previewBooks = validBooks;
      replaceFromBackup.hidden = false;
      try {
        const currentBooks = loadBooks();
        showBackupMatches(findBackupMatches(currentBooks));
        addFromBackup.hidden = validBooks.length === 0;
      } catch {
        backupPreview.textContent += " Текущий список не удалось прочитать.";
      }
    }
  }
});

addFromBackup.addEventListener("click", () => {
  let currentBooks;
  try {
    currentBooks = loadBooks();
  } catch {
    announce("Не удалось загрузить текущий список.");
    return;
  }

  const matches = findBackupMatches(currentBooks);
  if (matches.some((index) => !matchChoices.has(index))) {
    showBackupMatches(matches);
    backupPreview.textContent = "Появились новые совпадения. Проверьте выбор.";
    return;
  }
  const skipped = new Set(matches.filter((index) => !matchChoices.get(index).checked));
  const addedBooks = previewBooks.filter((_, index) => !skipped.has(index));
  if (addedBooks.length === 0) {
    backupPreview.textContent = "Нет книг для добавления.";
    return;
  }
  if (saveBooks([...currentBooks, ...addedBooks])) {
    clearBackupPreview();
    renderBooks();
    announce(`Добавлено книг: ${addedBooks.length}.`);
  }
});

replaceFromBackup.addEventListener("click", () => {
  if (replaceFromBackup.hidden) {
    return;
  }
  try {
    const stored = localStorage.getItem(storageKey);
    let currentCount;
    try {
      currentCount = parseStoredBooks(stored).length;
    } catch {
      // A valid backup can replace an unreadable list after confirmation.
    }
    const removal = currentCount === undefined
      ? "Текущий список повреждён. Все его данные будут удалены. Число записей определить не удалось."
      : `Все текущие записи будут удалены (${currentCount}).`;
    const message = previewBooks.length === 0
      ? `Копия пуста. ${removal} В списке останется 0 книг. Продолжить?`
      : `Заменить список? ${removal} Будет восстановлено записей: ${previewBooks.length}.`;
    if (!window.confirm(message)) {
      return;
    }
    if (localStorage.getItem(storageKey) !== stored) {
      backupPreview.textContent = "Список изменился. Нажмите «Заменить список» ещё раз.";
      return;
    }
  } catch {
    announce("Не удалось загрузить текущий список.");
    return;
  }

  const restoredCount = previewBooks.length;
  if (saveBooks(previewBooks)) {
    clearBackupPreview();
    renderBooks();
    announce(`Восстановлено книг: ${restoredCount}.`);
  }
});

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
