const fallbackMeals = [
  {
    id: "demo-1",
    title: "Pasta met pesto",
    type: "photo",
    image_url: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=900&q=80",
    thought: "Pasta koken. Pesto, Parmezaan en een beetje citroen toevoegen.",
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-2",
    title: "Risotto",
    type: "photo",
    image_url: "https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?auto=format&fit=crop&w=900&q=80",
    thought: "Rijst langzaam garen met bouillon. Afmaken met kaas en paddenstoelen.",
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-3",
    title: "Lunch buiten",
    type: "photo",
    image_url: "https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=900&q=80",
    thought: "Brood, salade, ei en iets fris erbij.",
    created_at: new Date().toISOString(),
  },
];

const state = {
  meals: [...fallbackMeals],
  tapTimer: null,
};

const els = {};

function $(selector) {
  return document.querySelector(selector);
}

function cacheElements() {
  els.grid = $("#mealGrid");
  els.addOpen = $("#addOpen");
  els.addClose = $("#addClose");
  els.sheet = $("#uploadSheet");
  els.backdrop = $("#sheetBackdrop");
  els.form = $("#mealForm");
  els.fileInput = $("#fileInput");
  els.photoPreview = $("#photoPreview");
  els.uploadEmpty = $("#uploadEmpty");
  els.formStatus = $("#formStatus");
  els.submitButton = $("#submitButton");
  els.infoLayer = $("#infoLayer");
  els.infoClose = $("#infoClose");
  els.infoTitle = $("#infoTitle");
  els.infoText = $("#infoText");
}

function render() {
  const meals = state.meals.filter((meal) => meal.image_url);
  els.grid.innerHTML = "";

  for (const meal of meals) {
    const card = document.createElement("article");
    card.className = "meal-card";
    card.tabIndex = 0;
    card.dataset.id = meal.id;
    card.innerHTML = `
      <img loading="lazy" src="${escapeAttribute(meal.image_url)}" alt="${escapeAttribute(meal.title || "Maaltje")}" />
      <div class="name-overlay">${escapeHtml(meal.title || "Maaltje")}</div>
    `;

    card.addEventListener("click", () => handleMealTap(card, meal));
    card.addEventListener("dblclick", (event) => {
      event.preventDefault();
      clearTimeout(state.tapTimer);
      showRecipe(meal);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter") showRecipe(meal);
      if (event.key === " ") {
        event.preventDefault();
        toggleName(card);
      }
    });

    els.grid.appendChild(card);
  }
}

function handleMealTap(card, meal) {
  if (state.tapTimer) {
    clearTimeout(state.tapTimer);
    state.tapTimer = null;
    showRecipe(meal);
    return;
  }

  state.tapTimer = setTimeout(() => {
    toggleName(card);
    state.tapTimer = null;
  }, 240);
}

function toggleName(card) {
  document.querySelectorAll(".meal-card.show-name").forEach((openCard) => {
    if (openCard !== card) openCard.classList.remove("show-name");
  });
  card.classList.toggle("show-name");
}

function showRecipe(meal) {
  els.infoTitle.textContent = meal.title || "Maaltje";
  els.infoText.textContent = meal.thought || "";
  els.infoLayer.hidden = false;
}

function closeRecipe() {
  els.infoLayer.hidden = true;
}

function openSheet() {
  els.backdrop.hidden = false;
  els.sheet.hidden = false;
  document.body.style.overflow = "hidden";
  els.formStatus.textContent = "";
  els.formStatus.classList.remove("error");
  setTimeout(() => $("#nameInput")?.focus(), 50);
}

function closeSheet() {
  els.backdrop.hidden = true;
  els.sheet.hidden = true;
  document.body.style.overflow = "";
  resetForm();
}

function resetForm() {
  els.form.reset();
  els.photoPreview.hidden = true;
  els.photoPreview.removeAttribute("src");
  els.uploadEmpty.hidden = false;
  els.formStatus.textContent = "";
  els.formStatus.classList.remove("error");
  els.submitButton.disabled = false;
  els.submitButton.textContent = "Opslaan";
}

function handleFilePreview() {
  const file = els.fileInput.files?.[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  els.photoPreview.src = url;
  els.photoPreview.hidden = false;
  els.uploadEmpty.hidden = true;
}

async function handleSubmit(event) {
  event.preventDefault();

  const form = new FormData(els.form);
  const file = els.fileInput.files?.[0];
  const payload = {
    title: String(form.get("title") || "").trim(),
    type: "photo",
    thought: String(form.get("thought") || "").trim(),
    file,
  };

  if (!payload.title) {
    setStatus("Vul een naam in.", true);
    return;
  }

  if (!file) {
    setStatus("Kies een foto.", true);
    return;
  }

  els.submitButton.disabled = true;
  els.submitButton.textContent = "Opslaan...";
  setStatus("");

  try {
    const meal = await window.MealsSupabase.createMemoryViaEdgeFunction(payload);
    state.meals = [meal, ...state.meals.filter((item) => !String(item.id).startsWith("demo-"))];
    render();
    closeSheet();
  } catch (error) {
    console.error(error);
    setStatus("Opslaan lukte nog niet.", true);
    els.submitButton.disabled = false;
    els.submitButton.textContent = "Opslaan";
  }
}

function setStatus(message, isError = false) {
  els.formStatus.textContent = message;
  els.formStatus.classList.toggle("error", isError);
}

function bindEvents() {
  els.addOpen.addEventListener("click", openSheet);
  els.addClose.addEventListener("click", closeSheet);
  els.backdrop.addEventListener("click", closeSheet);
  els.fileInput.addEventListener("change", handleFilePreview);
  els.form.addEventListener("submit", handleSubmit);
  els.infoClose.addEventListener("click", closeRecipe);
  els.infoLayer.addEventListener("click", (event) => {
    if (event.target === els.infoLayer) closeRecipe();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!els.sheet.hidden) closeSheet();
      if (!els.infoLayer.hidden) closeRecipe();
    }
  });
}

async function boot() {
  cacheElements();
  window.MealsSupabase.initSupabase();
  bindEvents();
  render();
  registerServiceWorker();

  const remoteMeals = await window.MealsSupabase.fetchMemoriesFromSupabase();
  if (remoteMeals.length) {
    state.meals = remoteMeals.filter((meal) => meal.image_url);
    render();
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch((error) => {
      console.warn("Service worker registreren lukte niet.", error);
    });
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/'/g, "&#039;");
}

document.addEventListener("DOMContentLoaded", boot);
