```javascript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  WHATSAPP_NUMBER
} from "./config.js";

const $ = (selector) => document.querySelector(selector);

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);

const digits = (value) => String(value ?? "").replace(/\D/g, "");

const money = (value, currency = "EUR") =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency
  }).format(Number(value || 0));

const loginPanel = $("#login-panel");
const dashboard = $("#dashboard");
const loginMessage = $("#login-msg");

let sb = null;
let reservations = [];
let quotes = [];

const ready = Boolean(
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  SUPABASE_URL.startsWith("https://")
);

if (ready) {
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else if (loginMessage) {
  loginMessage.textContent = "Configuración de Supabase no disponible.";
}

function showMessage(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.style.color = isError ? "#c62828" : "";
}

// NAVEGACIÓN
function showTab(name) {
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("hidden", panel.id !== `tab-${name}`);
  });

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === name);
  });
}

document.querySelectorAll("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => showTab(button.dataset.tab));
});

// ESTADÍSTICAS DEL DASHBOARD
function renderStats() {
  const total = reservations.length;

  const pending = reservations.filter(
    (reservation) => reservation.status === "pending"
  ).length;

  const confirmed = reservations.filter(
    (reservation) => reservation.status === "confirmed"
  ).length;

  const totalQuotes = quotes.length;

  const totalElement = $("#stat-total");
  const pendingElement = $("#stat-pending");
  const confirmedElement = $("#stat-confirmed");
  const quotesElement = $("#stat-quotes");

  if (totalElement) totalElement.textContent = total;
  if (pendingElement) pendingElement.textContent = pending;
  if (confirmedElement) confirmedElement.textContent = confirmed;
  if (quotesElement) quotesElement.textContent = totalQuotes;
}

// LOGIN
$("#login-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!sb) return;

  const email = $("#login-email")?.value.trim();
  const password = $("#login-password")?.value;

  showMessage(loginMessage, "Iniciando sesión...");

  const { error } = await sb.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showMessage(
      loginMessage,
      "No se pudo iniciar sesión: " + error.message,
      true
    );
    return;
  }

  await initialize();
});

// LOGOUT
$("#logout")?.addEventListener("click", async () => {
  if (!sb) return;

  await sb.auth.signOut();
  location.reload();
});

// ACTUALIZAR
$("#refresh-all")?.addEventListener("click", async () => {
  await loadAll();
});

// FILTRO DE SOLICITUDES
$("#filter")?.addEventListener("change", () => {
  renderReservations();
});

// INICIALIZACIÓN DEL ADMINISTRADOR
async function initialize() {
  if (!sb) return;

  const {
    data: { session }
  } = await sb.auth.getSession();

  if (!session) {
    loginPanel?.classList.remove("hidden");
    dashboard?.classList.add("hidden");
    return;
  }

  const { data: admin, error } = await sb
    .from("admin_users")
    .select("user_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error || !admin) {
    showMessage(
      loginMessage,
      "Esta cuenta no tiene permisos de administrador.",
      true
    );

    await sb.auth.signOut();

    loginPanel?.classList.remove("hidden");
    dashboard?.classList.add("hidden");
    return;
  }

  loginPanel?.classList.add("hidden");
  dashboard?.classList.remove("hidden");

  await loadAll();
}

// CARGAR TODA LA INFORMACIÓN
async function loadAll() {
  if (!sb) return;

  showMessage($("#admin-msg"), "Actualizando información...");

  await Promise.all([
    loadReservations(),
    loadQuotes()
  ]);

  renderStats();

  showMessage($("#admin-msg"), "Información actualizada.");
}

// SOLICITUDES
async function loadReservations() {
  const { data, error } = await sb
    .from("reservations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    showMessage(
      $("#admin-msg"),
      "Error al cargar reservas: " + error.message,
      true
    );
    return;
  }

  reservations = data || [];

  renderReservations();
  renderStats();
}

function renderReservations() {
  const container = $("#reservations");
  if (!container) return;

  const filter = $("#filter")?.value || "all";

  const filtered = reservations.filter((reservation) => {
    return filter === "all" || reservation.status === filter;
  });

  if (!filtered.length) {
    container.innerHTML =
      '<div class="empty">No hay solicitudes para mostrar.</div>';
    return;
  }

  container.innerHTML = filtered.map((reservation) => {
    const id = esc(reservation.id);
    const phone = digits(reservation.phone) || digits(WHATSAPP_NUMBER);

    const whatsappMessage = encodeURIComponent(
      `Hola ${reservation.customer_name || ""}, hemos recibido tu solicitud de servicio con JONAS PREMIUM. En breve nos pondremos en contacto contigo.`
    );

    const whatsappUrl = phone
      ? `https://wa.me/${phone}?text=${whatsappMessage}`
      : "";

    return `
      <article class="reservation">
        <div class="reservation-header">
          <h3>${esc(reservation.customer_name || "Cliente")}</h3>
          <span class="status-pill">${esc(reservation.status || "pending")}</span>
        </div>

        <p><strong>Origen:</strong> ${esc(reservation.origin)}</p>
        <p><strong>Destino:</strong> ${esc(reservation.destination)}</p>
        <p><strong>Fecha:</strong> ${esc(reservation.travel_date)}</p>
        <p><strong>Hora:</strong> ${esc(reservation.travel_time)}</p>
        <p><strong>Pasajeros:</strong> ${esc(reservation.passengers)}</p>
        <p><strong>Teléfono:</strong> ${esc(reservation.phone)}</p>
        <p><strong>Correo:</strong>
