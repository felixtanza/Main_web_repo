// ============ DARK MODE TOGGLE ============
const toggleBtn = document.getElementById("darkModeToggle");
toggleBtn?.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("darkMode", document.body.classList.contains("dark"));
});
if (localStorage.getItem("darkMode") === "true") {
  document.body.classList.add("dark");
}

// ============ BACK TO TOP BUTTON ============
const backToTop = document.getElementById("backToTop");
window.addEventListener("scroll", () => {
  backToTop.style.display = window.scrollY > 200 ? "block" : "none";
});
backToTop?.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ============ TYPING ANIMATION ============
const typing = document.querySelector(".typing");
if (typing) {
  const words = ["Delicious!", "Fast Delivery!", "Affordable!"];
  let wordIndex = 0;
  let charIndex = 0;
  let isDeleting = false;

  const type = () => {
    const word = words[wordIndex];
    typing.textContent = word.slice(0, charIndex) + (isDeleting ? "" : "|");

    if (!isDeleting && charIndex < word.length) {
      charIndex++;
      setTimeout(type, 100);
    } else if (isDeleting && charIndex > 0) {
      charIndex--;
      setTimeout(type, 50);
    } else {
      isDeleting = !isDeleting;
      wordIndex = !isDeleting ? (wordIndex + 1) % words.length : wordIndex;
      setTimeout(type, 1000);
    }
  };
  type();
}

// ============ VISITOR COUNTER ============
const counter = document.getElementById("visitorCount");
if (counter) {
  let visits = localStorage.getItem("visits") || 0;
  visits++;
  localStorage.setItem("visits", visits);
  counter.textContent = visits;
}

// ============ MENU RENDERING ============
const menuContainer = document.getElementById("menuContainer") || document.getElementById("menuItems");
const cartContainer = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");
const hiddenCartInput = document.getElementById("hiddenCart") || {};
let cart = [];

const items = [
  { id: 1, name: "Chicken Biryani", price: 350 },
  { id: 2, name: "Beef Pilau", price: 300 },
  { id: 3, name: "Ugali & Sukuma", price: 150 },
  { id: 4, name: "Chapati & Beans", price: 180 },
  { id: 5, name: "Fried Tilapia", price: 400 },
  { id: 6, name: "Matoke & Beef", price: 250 },
  { id: 7, name: "Mandazi (2 pcs)", price: 80 },
  { id: 8, name: "French Fries", price: 200 },
  { id: 9, name: "Samosa (2 pcs)", price: 100 },
  { id: 10, name: "Grilled Chicken", price: 500 }
];

function updateCartDisplay() {
  cartContainer.innerHTML = "";
  let total = 0;

  cart.forEach((item, index) => {
    const row = document.createElement("div");
    row.classList.add("cart-row");
    row.innerHTML = `
      ${item.name} x${item.qty} - KES ${item.qty * item.price}
      <button onclick="removeItem(${index})">Remove</button>
    `;
    cartContainer.appendChild(row);
    total += item.qty * item.price;
  });

  cartTotal.textContent = `Total: KES ${total}`;
  if (hiddenCartInput) hiddenCartInput.value = JSON.stringify(cart);
}

function addItem(id) {
  const found = items.find(i => i.id === id);
  const existing = cart.find(c => c.id === id);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ ...found, qty: 1 });
  }
  updateCartDisplay();
}

function removeItem(index) {
  cart.splice(index, 1);
  updateCartDisplay();
}

if (menuContainer) {
  items.forEach(item => {
    const div = document.createElement("div");
    div.classList.add("menu-card");
    div.innerHTML = `
      <h4>${item.name}</h4>
      <p>KES ${item.price}</p>
      <button onclick="addItem(${item.id})">Add to Cart</button>
    `;
    menuContainer.appendChild(div);
  });
}

// ============ FORM SUBMISSION WITH LOADING ============
const paymentForm = document.getElementById("paymentForm");
const loader = document.getElementById("loader");

paymentForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (loader) loader.style.display = "block";

  const formData = new FormData(paymentForm);
  const data = Object.fromEntries(formData.entries());

  try {
    const res = await fetch("/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    window.location.href = res.redirected ? res.url : "/error";
  } catch (err) {
    alert("❌ Error processing payment");
    window.location.href = "/error";
  } finally {
    if (loader) loader.style.display = "none";
  }
});

// ============ LOGOUT FUNCTIONALITY ============
const logoutBtn = document.getElementById("logoutBtn");
logoutBtn?.addEventListener("click", async () => {
  try {
    const res = await fetch("/logout", { method: "POST" });
    if (res.ok) {
      window.location.href = "/login";
    } else {
      alert("Logout failed");
    }
  } catch (err) {
    console.error("Logout error:", err);
    alert("Logout error occurred");
  }
});
