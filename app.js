const state = {
  meals: [],
  tapTimer: null,
  selectedMeal: null,
  isEditingRecipe: false,
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
  els.infoDelete = $("#infoDelete");
  els.infoEdit = $("#infoEdit");
  els.infoTitle = $("#infoTitle");
  els.infoText = $("#infoText");
  els.recipeView = $("#recipeView");
  els.recipeEditForm = $("#recipeEditForm");
  els.editTitleInput = $("#editTitleInput");
  els.editRecipeInput = $("#editRecipeInput");
  els.editStatus = $("#editStatus");
  els.editCancel = $("#editCancel");
  els.editSave = $("#editSave");
}

function render() {
  const meals = state.meals.filter((meal) => meal && meal.image_url);
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
      state.tapTimer = null;
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
  state.selectedMeal = meal;
  state.isEditingRecipe = false;
  fillRecipeView(meal);
  showRecipeViewMode();
  els.infoDelete.textContent = "Verwijderen";
  els.infoDelete.disabled = false;
  els.infoLayer.hidden = false;
  document.body.style.overflow = "hidden";
}

function fillRecipeView(meal) {
  els.infoTitle.textContent = meal.title || "Maaltje";
  els.infoText.textContent = meal.thought || "Geen recept ingevuld.";
}

function closeRecipe() {
  els.infoLayer.hidden = true;
  document.body.style.overflow = "";
  state.selectedMeal = null;
  state.isEditingRecipe = false;
  els.infoDelete.disabled = false;
  els.editSave.disabled = false;
  showRecipeViewMode();
}

function showRecipeViewMode() {
  state.isEditingRecipe = false;
  els.recipeView.hidden = false;
  els.recipeEditForm.hidden = true;
  els.editStatus.textContent = "";
  els.editStatus.classList.remove("error");
}

function showRecipeEditMode() {
  const meal = state.selectedMeal;
  if (!meal) return;

  state.isEditingRecipe = true;
  els.recipeView.hidden = true;
  els.recipeEditForm.hidden = false;
  els.editTitleInput.value = meal.title || "";
  els.editRecipeInput.value = meal.thought || "";
  els.editSave.disabled = false;
  els.editSave.textContent = "Opslaan";
  els.editStatus.textContent = "";
  els.editStatus.classList.remove("error");
  setTimeout(() => els.editTitleInput.focus(), 50);
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
    state.meals = [meal, ...state.meals.filter((item) => item.id !== meal.id)];
    render();
    closeSheet();
  } catch (error) {
    console.error(error);
    setStatus("Opslaan lukte nog niet.", true);
    els.submitButton.disabled = false;
    els.submitButton.textContent = "Opslaan";
  }
}

async function handleEditSubmit(event) {
  event.preventDefault();

  const meal = state.selectedMeal;
  if (!meal || !meal.id) return;

  const title = els.editTitleInput.value.trim();
  const thought = els.editRecipeInput.value.trim();

  if (!title) {
    setEditStatus("Vul een naam in.", true);
    return;
  }

  els.editSave.disabled = true;
  els.editSave.textContent = "Opslaan...";
  setEditStatus("");

  try {
    const updatedMeal = await window.MealsSupabase.updateMemoryViaEdgeFunction({
      ...meal,
      title,
      thought,
    });

    const mergedMeal = { ...meal, ...updatedMeal, title, thought };
    state.meals = state.meals.map((item) => (item.id === meal.id ? mergedMeal : item));
    state.selectedMeal = mergedMeal;
    fillRecipeView(mergedMeal);
    render();
    showRecipeViewMode();
  } catch (error) {
    console.error(error);
    setEditStatus("Bewerken lukte nog niet.", true);
    els.editSave.disabled = false;
    els.editSave.textContent = "Opslaan";
  }
}

async function deleteSelectedMeal() {
  const meal = state.selectedMeal;
  if (!meal || !meal.id) return;

  const confirmed = window.confirm("Dit maaltje verwijderen?");
  if (!confirmed) return;

  els.infoDelete.disabled = true;
  els.infoDelete.textContent = "Verwijderen...";

  try {
    await window.MealsSupabase.deleteMemoryViaEdgeFunction(meal);
    state.meals = state.meals.filter((item) => item.id !== meal.id);
    render();
    closeRecipe();
  } catch (error) {
    console.error(error);
    els.infoDelete.disabled = false;
    els.infoDelete.textContent = "Verwijderen";
    window.alert("Verwijderen lukte nog niet.");
  }
}

function setStatus(message, isError = false) {
  els.formStatus.textContent = message;
  els.formStatus.classList.toggle("error", isError);
}

function setEditStatus(message, isError = false) {
  els.editStatus.textContent = message;
  els.editStatus.classList.toggle("error", isError);
}

function bindEvents() {
  els.addOpen.addEventListener("click", openSheet);
  els.addClose.addEventListener("click", closeSheet);
  els.backdrop.addEventListener("click", closeSheet);
  els.fileInput.addEventListener("change", handleFilePreview);
  els.form.addEventListener("submit", handleSubmit);
  els.infoClose.addEventListener("click", closeRecipe);
  els.infoDelete.addEventListener("click", deleteSelectedMeal);
  els.infoEdit.addEventListener("click", showRecipeEditMode);
  els.editCancel.addEventListener("click", showRecipeViewMode);
  els.recipeEditForm.addEventListener("submit", handleEditSubmit);
  els.infoLayer.addEventListener("click", (event) => {
    if (event.target === els.infoLayer && !state.isEditingRecipe) closeRecipe();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!els.sheet.hidden) closeSheet();
      if (!els.infoLayer.hidden) {
        if (state.isEditingRecipe) showRecipeViewMode();
        else closeRecipe();
      }
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
  state.meals = remoteMeals.filter((meal) => meal && meal.image_url);
  render();
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
