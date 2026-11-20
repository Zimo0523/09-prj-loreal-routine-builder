/* DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateBtn = document.getElementById("generateRoutine");
const clearBtn = document.getElementById("clearSelections");
const productSearch = document.getElementById("productSearch");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const chatWindow = document.getElementById("chatWindow");

/* Cloudflare Worker from Project 8 */
const WORKER_URL =
  "https://loreal-beauty-chatbot.zimo20079.workers.dev";

/* Application state */
let allProducts = [];
let selectedIds = [];
let busy = false;
const STORAGE_KEY = "loreal-routine-selected-products";

/* AI instructions */
const SYSTEM_PROMPT = `
You are a professional L'Oreal beauty routine advisor.

Only answer questions about beauty, skincare, haircare,
makeup, fragrance, and the user's selected products.

When generating a routine:
- Use only the supplied selected products.
- Consider each product's name, category, and description.
- Provide a clear step-by-step routine.
- Explain the order and purpose of each product.
- Distinguish morning and evening use when appropriate.
- Do not invent products or unsupported ingredients.
- Do not recommend unsafe combinations.
- Explain when selected products serve different purposes.

Remember the routine and previous messages during follow-up
conversations.

For unrelated questions, politely refuse without answering
the unrelated question.
`;

/* Full conversation history */
const messages = [
  { role: "system", content: SYSTEM_PROMPT }
];

/* Safe local storage */
function saveSelections() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(selectedIds)
    );
  } catch (error) {
    console.warn("Unable to save selections:", error);
  }
}

function restoreSelections() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );

    if (Array.isArray(saved)) {
      selectedIds = saved
        .map(Number)
        .filter(id =>
          allProducts.some(product => product.id === id)
        );
    }
  } catch (error) {
    selectedIds = [];
  }
}

/* Create an element with text safely */
function makeElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
}

/* Load products */
async function loadProducts() {
  try {
    const response = await fetch("products.json");

    if (!response.ok) {
      throw new Error("Could not load products.json");
    }

    const data = await response.json();
    allProducts = data.products;

    restoreSelections();
    renderProducts();
    renderSelectedProducts();
  } catch (error) {
    console.error("Product loading error:", error);
    productsContainer.textContent =
      "Unable to load products. Please refresh the page.";
  }
}

/* Apply category and keyword filters together */
function getFilteredProducts() {
  const category = categoryFilter.value;
  const keyword = productSearch.value.trim().toLowerCase();

  return allProducts.filter(product => {
    const matchesCategory =
      !category || product.category === category;

    const searchableText = [
      product.name,
      product.brand,
      product.category,
      product.description
    ].join(" ").toLowerCase();

    const matchesSearch =
      !keyword || searchableText.includes(keyword);

    return matchesCategory && matchesSearch;
  });
}

/* Render product cards */
function renderProducts() {
  productsContainer.replaceChildren();

  if (!categoryFilter.value && !productSearch.value.trim()) {
    productsContainer.appendChild(
      makeElement(
        "div",
        "placeholder-message",
        "Choose a category or search to browse products."
      )
    );
    return;
  }

  const products = getFilteredProducts();

  if (products.length === 0) {
    productsContainer.appendChild(
      makeElement(
        "div",
        "placeholder-message",
        "No matching products found."
      )
    );
    return;
  }

  products.forEach(product => {
    const selected = selectedIds.includes(product.id);
    const card = makeElement("div", "product-card");
    card.classList.toggle("selected", selected);
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-pressed", String(selected));
    card.setAttribute(
      "aria-label",
      `${selected ? "Deselect" : "Select"} ${product.name}`
    );

    const img = makeElement("img");
    img.src = product.image;
    img.alt = product.name;
    img.loading = "lazy";

    const info = makeElement("div", "product-info");
    info.appendChild(makeElement("h3", "", product.name));
    info.appendChild(makeElement("p", "", product.brand));

    const indicator = makeElement(
      "span",
      "selection-indicator",
      selected ? "✓ Selected" : "+ Select"
    );
    info.appendChild(indicator);

    const descriptionBtn = makeElement(
      "button",
      "description-btn",
      "View Description"
    );
    descriptionBtn.type = "button";

    const description = makeElement(
      "p",
      "product-description",
      product.description
    );
    description.hidden = true;

    descriptionBtn.addEventListener("click", event => {
      event.stopPropagation();
      description.hidden = !description.hidden;
      descriptionBtn.textContent = description.hidden
        ? "View Description"
        : "Hide Description";
    });

    card.addEventListener("click", () => {
      toggleProduct(product.id);
    });

    card.addEventListener("keydown", event => {
      if (event.target !== card) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleProduct(product.id);
      }
    });

    card.append(img, info, descriptionBtn, description);
    productsContainer.appendChild(card);
  });
}

/* Select or deselect a product */
function toggleProduct(id) {
  if (selectedIds.includes(id)) {
    selectedIds = selectedIds.filter(item => item !== id);
  } else {
    selectedIds.push(id);
  }

  saveSelections();
  renderProducts();
  renderSelectedProducts();
}

/* Selected products area */
function renderSelectedProducts() {
  selectedProductsList.replaceChildren();

  const selected = allProducts.filter(product =>
    selectedIds.includes(product.id)
  );

  if (selected.length === 0) {
    selectedProductsList.appendChild(
      makeElement("p", "", "No products selected yet.")
    );
  }

  selected.forEach(product => {
    const item = makeElement("div", "selected-product-item");
    const name = makeElement(
      "span",
      "",
      `${product.brand} — ${product.name}`
    );

    const removeBtn = makeElement(
      "button",
      "remove-product-btn",
      "Remove"
    );
    removeBtn.type = "button";
    removeBtn.addEventListener("click", () => {
      toggleProduct(product.id);
    });

    item.append(name, removeBtn);
    selectedProductsList.appendChild(item);
  });

  generateBtn.disabled = busy || selected.length === 0;
  clearBtn.disabled = selected.length === 0;
}

/* Clear all selections */
clearBtn.addEventListener("click", () => {
  selectedIds = [];
  saveSelections();
  renderProducts();
  renderSelectedProducts();
});

/* Live product search and category filter */
categoryFilter.addEventListener("change", renderProducts);
productSearch.addEventListener("input", renderProducts);

/* Chat bubbles */
function addMessage(text, role) {
  const bubble = makeElement("div", `msg ${role}`, text);
  chatWindow.appendChild(bubble);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return bubble;
}

/* Loading state */
function setBusy(value) {
  busy = value;
  sendBtn.disabled = value;
  userInput.disabled = value;
  generateBtn.disabled = value || selectedIds.length === 0;
  clearBtn.disabled = value || selectedIds.length === 0;
}

/* Send conversation to Cloudflare */
async function sendToAI(question, displayQuestion = true) {
  if (busy) return;

  if (displayQuestion) {
    addMessage(question, "user");
  }

  const loading = addMessage("Generating response...", "ai");

  setBusy(true);

  const requestMessages = [
    ...messages,
    { role: "user", content: question }
  ];

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: requestMessages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || `API request failed: ${response.status}`
      );
    }

    const answer = data.choices?.[0]?.message?.content;

    if (!answer) {
      throw new Error("No AI answer received.");
    }

    loading.textContent = answer;

    messages.push(
      { role: "user", content: question },
      { role: "assistant", content: answer }
    );
  } catch (error) {
    console.error("AI request error:", error);
    loading.textContent =
      "Sorry, the AI service is unavailable. Please try again.";
  } finally {
    setBusy(false);
    renderSelectedProducts();
    chatWindow.scrollTop = chatWindow.scrollHeight;
    userInput.focus();
  }
}

/* Generate a routine from selected product data */
generateBtn.addEventListener("click", async () => {
  const selected = allProducts.filter(product =>
    selectedIds.includes(product.id)
  );

  if (selected.length === 0 || busy) return;

  const productData = selected.map(product => ({
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description
  }));

  const question = `
Create a personalized beauty routine using ONLY these
selected products:

${JSON.stringify(productData, null, 2)}

Explain the order, purpose, and appropriate time of use.
Use only the supplied product information.
If products are not intended to be used together,
explain that clearly.
`;

  addMessage(
    `Generate a routine using: ${selected.map(
      product => product.name
    ).join(", ")}`,
    "user"
  );

  await sendToAI(question, false);
});

/* Follow-up chat */
chatForm.addEventListener("submit", async event => {
  event.preventDefault();

  const question = userInput.value.trim();

  if (!question || busy) return;

  userInput.value = "";
  await sendToAI(question);
});

/* Initial state */
addMessage(
  "Welcome to L'Oréal Routine Builder! Select products, " +
  "generate a routine, or ask a beauty-related question.",
  "ai"
);

loadProducts();
