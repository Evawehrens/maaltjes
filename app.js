const sampleMemories = [
  {
    id: "demo-1",
    type: "photo",
    title: "Pasta pesto met parmezaan",
    image_url: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=700&q=80",
    created_at: new Date().toISOString(),
    size: "tall"
  },
  {
    id: "demo-2",
    type: "photo",
    title: "Risotto buiten aan tafel",
    image_url: "https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=700&q=80",
    created_at: new Date().toISOString(),
    size: "medium"
  },
  {
    id: "demo-3",
    type: "photo",
    title: "Zomerse pastasalade",
    image_url: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=700&q=80",
    created_at: new Date().toISOString(),
    size: "medium"
  },
  {
    id: "demo-4",
    type: "photo",
    title: "Romige gnocchi met tomaat",
    image_url: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=700&q=80",
    created_at: new Date().toISOString(),
    size: "tall"
  },
  {
    id: "demo-5",
    type: "video",
    title: "Roeren in de pan",
    image_url: "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=700&q=80",
    created_at: new Date().toISOString(),
    size: "medium"
  },
  {
    id: "demo-6",
    type: "thought",
    title: "Volgende keer meer citroen en minder room.",
    thought: "Volgende keer meer citroen en minder room.",
    created_at: new Date().toISOString()
  },
  {
    id: "demo-7",
    type: "photo",
    title: "Broodplank in de zon",
    image_url: "https://images.unsplash.com/photo-1543353071-10c8ba85a904?auto=format&fit=crop&w=700&q=80",
    created_at: new Date().toISOString(),
    size: "medium"
  },
  {
    id: "demo-8",
    type: "photo",
    title: "Avondeten met salade",
    image_url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=700&q=80",
    created_at: new Date().toISOString(),
    size: "tall"
  }
];

const state = {
  memories: [],
  activeFilter: "all",
  search: ""
};

const grid = document.querySelector("#memoryGrid");
const tabs = document.querySelectorAll(".tab");
const searchToggle = document.querySelector("#searchToggle");
const searchPanel = document.querySelector("#searchPanel");
const searchInput = document.querySelector("#searchInput");
const filterButton = document.querySelector("#filterButton");
const saveButton = document.querySelector("#saveButton");
const modalBackdrop = document.querySelector("#modalBackdrop");
const closeModal = document.querySelector("#closeModal");
const memoryForm = document.querySelector("#memoryForm");
const notice = document.querySelector("#notice");
const memoryCount = document.querySelector("#memoryCount");

function showNotice(message) {
  notice.textContent = message;
  notice.hidden = false;
  window.setTimeout(() => {
    notice.hidden = true;
    notice.textContent = "";
  }, 3200);
}

function getLocalMemories() {
  try {
    return JSON.parse(localStorage.getItem("meals-local-memories") || "[]");
  } catch {
    return [];
  }
}

function saveLocalMemory(memory) {
  const local = getLocalMemories();
  local.unshift(memory);
  localStorage.setItem("meals-local-memories", JSON.stringify(local));
}

function normalizeMemory(memory, index) {
  return {
    id: memory.id || `memory-${index}`,
    type: memory.type || "photo",
    title: memory.title || "Untitled meal",
    thought: memory.thought || "",
    image_url: memory.image_url || "",
    created_at: memory.created_at || new Date().toISOString(),
    size: memory.size || (index % 3 === 0 ? "tall" : "medium")
  };
}

function filteredMemories() {
  return state.memories.filter((memory) => {
    const matchesType = state.activeFilter === "all" || memory.type === state.activeFilter;
    const query = state.search.trim().toLowerCase();
    const matchesSearch = !query || `${memory.title} ${memory.thought || ""}`.toLowerCase().includes(query);
    return matchesType && matchesSearch;
  });
}

function renderMemories() {
  const memories = filteredMemories();
  memoryCount.textContent = state.memories.length || 46;
  grid.innerHTML = "";

  if (!memories.length) {
    grid.innerHTML = `<article class="memory-card thought-card"><span class="type-badge">empty</span><p class="thought-text">Geen memories gevonden.</p></article>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  memories.forEach((memory) => {
    const card = document.createElement("article");
    card.className = `memory-card ${memory.type === "thought" ? "thought-card" : memory.size || "medium"}`;

    if (memory.type === "thought" || !memory.image_url) {
      card.innerHTML = `<span class="type-badge">${memory.type}</span><p class="thought-text">${escapeHtml(memory.thought || memory.title)}</p>`;
    } else {
      card.innerHTML = `
        <img src="${memory.image_url}" alt="${escapeHtml(memory.title)}" loading="lazy" />
        <span class="type-badge">${memory.type === "video" ? "video" : "photo"}</span>
        <span class="memory-title">${escapeHtml(memory.title)}</span>
      `;
    }

    fragment.appendChild(card);
  });

  grid.appendChild(fragment);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadMemories() {
  const local = getLocalMemories().map(normalizeMemory);
  const client = window.MealsSupabase?.initSupabase?.();

  if (!client) {
    state.memories = [...local, ...sampleMemories.map(normalizeMemory)];
    renderMemories();
    return;
  }

  const remote = await window.MealsSupabase.fetchMemories();
  state.memories = remote.length
    ? remote.map(normalizeMemory)
    : [...local, ...sampleMemories.map(normalizeMemory)];

  renderMemories();
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((item) => {
      item.classList.remove("active");
      item.setAttribute("aria-selected", "false");
    });
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    state.activeFilter = tab.dataset.filter;
    renderMemories();
  });
});

searchToggle.addEventListener("click", () => {
  searchPanel.hidden = !searchPanel.hidden;
  if (!searchPanel.hidden) searchInput.focus();
});

searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderMemories();
});

filterButton.addEventListener("click", () => {
  showNotice("Filters komen later. De tabs werken alvast.");
});

function openModal() {
  modalBackdrop.hidden = false;
  document.body.style.overflow = "hidden";
  memoryForm.elements.title.focus();
}

function closeModalPanel() {
  modalBackdrop.hidden = true;
  document.body.style.overflow = "";
  memoryForm.reset();
}

saveButton.addEventListener("click", openModal);
closeModal.addEventListener("click", closeModalPanel);
modalBackdrop.addEventListener("click", (event) => {
  if (event.target === modalBackdrop) closeModalPanel();
});

memoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(memoryForm);
  const file = formData.get("file");
  const title = formData.get("title").toString().trim();
  const type = formData.get("type").toString();
  const thought = formData.get("thought").toString().trim();

  let upload = null;
  if (file && file.size > 0) {
    upload = await window.MealsSupabase?.uploadPhotoToSupabase?.(file);
  }

  const memory = {
    id: crypto.randomUUID(),
    title,
    type,
    thought,
    image_url: upload?.image_url || (file && file.size > 0 ? URL.createObjectURL(file) : ""),
    storage_path: upload?.storage_path || "",
    created_at: new Date().toISOString(),
    size: "medium"
  };

  const savedRemote = await window.MealsSupabase?.createMemoryRecord?.({
    title: memory.title,
    type: memory.type,
    thought: memory.thought,
    image_url: upload?.image_url || "",
    storage_path: upload?.storage_path || ""
  });

  if (!savedRemote) saveLocalMemory(memory);

  let githubSync = null;
  if (upload?.storage_path && savedRemote) {
    githubSync = await window.MealsSupabase?.syncPhotoToGithub?.({
      id: savedRemote.id,
      title: savedRemote.title,
      image_url: upload.image_url,
      storage_path: upload.storage_path
    });
  }

  state.memories.unshift(normalizeMemory(savedRemote || memory));
  renderMemories();
  closeModalPanel();

  if (savedRemote && githubSync?.ok) {
    showNotice("Memory opgeslagen en foto naar GitHub gesynchroniseerd.");
  } else if (savedRemote) {
    showNotice("Memory opgeslagen in Supabase. GitHub sync nog niet gelukt of nog niet gedeployed.");
  } else {
    showNotice("Memory lokaal opgeslagen. Richt Supabase in voor echte opslag.");
  }
});

loadMemories();
