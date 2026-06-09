const fallbackMemories = [
  {
    id: "demo-1",
    title: "Pasta met pesto",
    type: "photo",
    image_url: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=900&q=80",
    thought: "Zomerse pasta in de tuin.",
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-2",
    title: "Risotto met paddestoelen",
    type: "photo",
    image_url: "https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?auto=format&fit=crop&w=900&q=80",
    thought: "Rustig koken op zondag.",
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-3",
    title: "Lunch buiten",
    type: "photo",
    image_url: "https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=900&q=80",
    thought: "Brood, salade en zon.",
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-4",
    title: "Goed onthouden",
    type: "thought",
    image_url: "",
    thought: "Volgende keer iets meer citroen en minder room gebruiken.",
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-5",
    title: "Gnocchi test",
    type: "photo",
    image_url: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=80",
    thought: "Lekker zacht, saus mag pittiger.",
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-6",
    title: "Kookvideo voorbereiding",
    type: "video",
    image_url: "https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=900&q=80",
    thought: "Eerste poging om stappen vast te leggen.",
    created_at: new Date().toISOString(),
  },
];

const state = {
  memories: [...fallbackMemories],
  filter: "all",
  search: "",
};

const els = {};

function $(selector) { return document.querySelector(selector); }
function $all(selector) { return [...document.querySelectorAll(selector)]; }

function cacheElements() {
  els.grid = $("#memoryGrid");
  els.count = $("#memoryCount");
  els.cover = $("#coverTile");
  els.tabs = $all(".tab");
  els.searchToggle = $("#searchToggle");
  els.searchPanel = $("#searchPanel");
  els.searchInput = $("#searchInput");
  els.filterButton = $("#filterButton");
  els.saveOpen = $("#saveOpen");
  els.saveClose = $("#saveClose");
  els.sheet = $("#uploadSheet");
  els.backdrop = $("#sheetBackdrop");
  els.form = $("#memoryForm");
  els.fileInput = $("#fileInput");
  els.photoPreview = $("#photoPreview");
  els.uploadEmpty = $("#uploadEmpty");
  els.formStatus = $("#formStatus");
  els.submitButton = $("#submitButton");
}

function normalizedType(type) {
  if (!type) return "photo";
  return String(type).toLowerCase();
}

function getVisibleMemories() {
  const q = state.search.trim().toLowerCase();
  return state.memories.filter((item) => {
    const typeOk = state.filter === "all" || normalizedType(item.type) === state.filter;
    const text = `${item.title || ""} ${item.thought || ""}`.toLowerCase();
    const searchOk = !q || text.includes(q);
    return typeOk && searchOk;
  });
}

function render() {
  const visible = getVisibleMemories();
  els.count.textContent = String(state.memories.length);
  renderCover();
  renderGrid(visible);
}

function renderCover() {
  const firstWithImage = state.memories.find((item) => item.image_url);
  els.cover.classList.toggle("has-image", Boolean(firstWithImage));
  if (firstWithImage) {
    els.cover.style.backgroundImage = `url("${firstWithImage.image_url}")`;
  } else {
    els.cover.style.backgroundImage = "";
  }
}

function renderGrid(memories) {
  els.grid.innerHTML = "";
  if (!memories.length) {
    els.grid.innerHTML = `<div class="empty-state">Geen memories gevonden.</div>`;
    return;
  }

  for (const item of memories) {
    const card = document.createElement("article");
    const type = normalizedType(item.type);
    card.className = type === "thought" && !item.image_url ? "memory-card thought-card" : "memory-card";

    if (type === "thought" && !item.image_url) {
      card.innerHTML = `<div><h3>${escapeHtml(item.title || "Gedachte")}</h3><p>${escapeHtml(item.thought || "")}</p></div><small>Thought</small>`;
    } else {
      card.innerHTML = `
        <img loading="lazy" src="${escapeAttribute(item.image_url || "")}" alt="${escapeAttribute(item.title || "Memory")}" />
        <div class="memory-caption"><h3>${escapeHtml(item.title || "Memory")}</h3></div>
      `;
    }
    els.grid.appendChild(card);
  }
}

function openSheet() {
  els.backdrop.hidden = false;
  els.sheet.hidden = false;
  document.body.style.overflow = "hidden";
  els.formStatus.textContent = "";
  els.formStatus.classList.remove("error");
  setTimeout(() => $("#titleInput")?.focus(), 50);
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
    type: String(form.get("type") || "photo"),
    thought: String(form.get("thought") || "").trim(),
    file,
  };

  if (!payload.title) {
    setStatus("Vul eerst een titel in.", true);
    return;
  }
  if (payload.type !== "thought" && !file) {
    setStatus("Kies eerst een foto.", true);
    return;
  }

  els.submitButton.disabled = true;
  els.submitButton.textContent = "Opslaan...";
  setStatus("Memory wordt opgeslagen...");

  try {
    const memory = await window.MealsSupabase.createMemoryViaEdgeFunction(payload);
    state.memories = [memory, ...state.memories.filter((item) => !String(item.id).startsWith("demo-"))];
    render();
    closeSheet();
  } catch (error) {
    console.error(error);
    setStatus("Opslaan lukte nog niet. Controleer de Edge Function en secrets.", true);
    els.submitButton.disabled = false;
    els.submitButton.textContent = "Opslaan";
  }
}

function setStatus(message, isError = false) {
  els.formStatus.textContent = message;
  els.formStatus.classList.toggle("error", isError);
}

function bindEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      state.filter = tab.dataset.filter;
      els.tabs.forEach((t) => t.classList.toggle("active", t === tab));
      render();
    });
  });

  els.searchToggle.addEventListener("click", () => {
    els.searchPanel.hidden = !els.searchPanel.hidden;
    if (!els.searchPanel.hidden) els.searchInput.focus();
  });
  els.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value;
    render();
  });
  els.filterButton.addEventListener("click", () => console.info("Filterknop is voorbereid voor versie 3."));
  els.saveOpen.addEventListener("click", openSheet);
  els.saveClose.addEventListener("click", closeSheet);
  els.backdrop.addEventListener("click", closeSheet);
  els.fileInput.addEventListener("change", handleFilePreview);
  els.form.addEventListener("submit", handleSubmit);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.sheet.hidden) closeSheet();
  });
}

async function boot() {
  cacheElements();
  window.MealsSupabase.initSupabase();
  bindEvents();
  render();

  const remoteMemories = await window.MealsSupabase.fetchMemoriesFromSupabase();
  if (remoteMemories.length) {
    state.memories = remoteMemories;
    render();
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}
function escapeAttribute(value) { return escapeHtml(value).replace(/'/g, "&#039;"); }

document.addEventListener("DOMContentLoaded", boot);
