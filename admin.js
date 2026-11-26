javascript
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

// DASHBOARD STATISTICS
function updateStats() {
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

// NAVIGATION
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

// REFRESH
$("#refresh-all")?.addEventListener("click", async () => {
  await loadAll();
});

// FILTER
$("#filter")?.addEventListener("change", () => {
  renderReservations();
});

// ADMIN INITIALIZATION
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

// LOAD ALL DATA
async function loadAll() {
  showMessage($("#admin-msg"), "Actualizando información...");

  await Promise.all([
    loadReservations(),
    loadQuotes()
  ]);

  updateStats();

  showMessage($("#admin-msg"), "Información actualizada.");
}

// RESERVATIONS
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
  updateStats();
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
        <p><strong>Correo:</strong> ${esc(reservation.email)}</p>
        ${reservation.notes ? `<p><strong>Observaciones:</strong> ${esc(reservation.notes)}</p>` : ""}

        <div class="reservation-actions">
          <label>
            Estado de la solicitud
            <select data-status="${id}">
              <option value="pending" ${reservation.status === "pending" ? "selected" : ""}>Pendiente</option>
              <option value="confirmed" ${reservation.status === "confirmed" ? "selected" : ""}>Confirmada</option>
              <option value="completed" ${reservation.status === "completed" ? "selected" : ""}>Completada</option>
              <option value="cancelled" ${reservation.status === "cancelled" ? "selected" : ""}>Cancelada</option>
            </select>
          </label>

          ${whatsappUrl ? `<a class="smallbtn" href="${esc(whatsappUrl)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ""}
        </div>

        <div class="quote-form">
          <h4>Preparar presupuesto</h4>

          <form data-manual-quote="${id}">
            <label>
              Precio (€)
              <input
                type="number"
                name="total"
                min="0.01"
                step="0.01"
                required
                placeholder="Ej. 85.00"
              >
            </label>

            <label>
              Válido hasta
              <input type="date" name="valid_until">
            </label>

            <label>
              Condiciones o detalles
              <textarea name="conditions" rows="2" placeholder="Detalles adicionales del presupuesto"></textarea>
            </label>

            <button type="submit">Guardar y preparar presupuesto</button>
            <p class="notice quote-message" data-quote-msg="${id}" role="status"></p>
          </form>
        </div>
      </article>
    `;
  }).join("");

  container.querySelectorAll("[data-status]").forEach((select) => {
    select.addEventListener("change", async () => {
      const id = select.dataset.status;
      const newStatus = select.value;

      const { error } = await sb
        .from("reservations")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) {
        showMessage(
          $("#admin-msg"),
          "No se pudo actualizar el estado: " + error.message,
          true
        );
        return;
      }

      showMessage($("#admin-msg"), "Estado de la reserva actualizado.");

      await loadReservations();
      updateStats();
    });
  });

  container.querySelectorAll("[data-manual-quote]").forEach((form) => {
    form.addEventListener("submit", handleManualQuote);
  });
}

// MANUAL QUOTE CREATION
async function handleManualQuote(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const reservationId = form.dataset.manualQuote;

  const reservation = reservations.find(
    (item) => String(item.id) === String(reservationId)
  );

  const messageElement = form.querySelector("[data-quote-msg]");
  const submitButton = form.querySelector('button[type="submit"]');

  if (!reservation) {
    showMessage(messageElement, "No se encontró la reserva.", true);
    return;
  }

  const total = Number(form.elements.total.value);

  if (!Number.isFinite(total) || total <= 0) {
    showMessage(messageElement, "Introduce un precio válido.", true);
    return;
  }

  const validUntilValue = form.elements.valid_until.value;
  let validUntil = null;

  if (validUntilValue) {
    validUntil = new Date(
      `${validUntilValue}T23:59:59`
    ).toISOString();
  }

  const conditions = form.elements.conditions.value.trim();

  const payload = {
    reservation_id: reservation.id,
    status: "prepared",
    pricing_type: "custom",
    currency: "EUR",
    subtotal: total,
    extras_total: 0,
    total,
    distance_km: null,
    duration_minutes: null,
    pricing_snapshot: {
      method: "manual_admin_quote",
      currency: "EUR",
      total,
      created_at: new Date().toISOString(),
      reservation: {
        origin: reservation.origin,
        destination: reservation.destination
      }
    },
    conditions: conditions || null,
    valid_until: validUntil,
    updated_at: new Date().toISOString()
  };

  submitButton.disabled = true;

  showMessage(messageElement, "Guardando presupuesto...");

  try {
    const { error } = await sb
      .from("quotes")
      .insert(payload);

    if (error) throw error;

    form.reset();

    showMessage(
      messageElement,
      "Presupuesto guardado correctamente. Puedes consultarlo en la pestaña Presupuestos."
    );

    await loadQuotes();
    updateStats();

  } catch (error) {
    showMessage(
      messageElement,
      "No se pudo guardar: " + error.message,
      true
    );
  } finally {
    submitButton.disabled = false;
  }
}

// QUOTE HISTORY
async function loadQuotes() {
  const container = $("#quotes-list");
  if (!container) return;

  const { data, error } = await sb
    .from("quotes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    quotes = [];
    updateStats();

    container.innerHTML =
      `<div class="empty">Error al cargar presupuestos: ${esc(error.message)}</div>`;

    return;
  }

  quotes = data || [];
  updateStats();

  const reservationIds = [...new Set(
    quotes.map((quote) => quote.reservation_id).filter(Boolean)
  )];

  let relatedReservations = [];

  if (reservationIds.length) {
    const result = await sb
      .from("reservations")
      .select("id,customer_name,origin,destination,travel_date,travel_time,phone,email")
      .in("id", reservationIds);

    if (result.error) {
      container.innerHTML =
        `<div class="empty">Error al cargar los datos de las reservas: ${esc(result.error.message)}</div>`;
      return;
    }

    relatedReservations = result.data || [];
  }

  const reservationMap = new Map(
    relatedReservations.map((reservation) => [
      String(reservation.id),
      reservation
    ])
  );

  const quoteIds = quotes.map((quote) => quote.id);
  let messages = [];

  if (quoteIds.length) {
    const result = await sb
      .from("quote_messages")
      .select("*")
      .in("quote_id", quoteIds)
      .order("created_at", { ascending: false });

    if (result.error) {
      container.innerHTML =
        `<div class="empty">Error al cargar el historial de mensajes: ${esc(result.error.message)}</div>`;
      return;
    }

    messages = result.data || [];
  }

  if (!quotes.length) {
    container.innerHTML =
      '<div class="empty">Todavía no hay presupuestos preparados.</div>';
    return;
  }

  container.innerHTML = quotes.map((quote) => {
    const reservation =
      reservationMap.get(String(quote.reservation_id)) || {};

    const quoteId = esc(quote.id);

    const quoteMessages = messages.filter(
      (message) => String(message.quote_id) === String(quote.id)
    );

    return `
      <article class="data-card">
        <h3>${esc(reservation.customer_name || "Cliente")}</h3>

        <p><strong>Trayecto:</strong> ${esc(reservation.origin || "—")} → ${esc(reservation.destination || "—")}</p>
        <p><strong>Fecha:</strong> ${esc(reservation.travel_date || "—")} · ${esc(reservation.travel_time || "—")}</p>

        <p><strong>Presupuesto:</strong> ${esc(money(quote.total, quote.currency || "EUR"))}</p>
        <p><strong>Estado:</strong> ${esc(quote.status)}</p>
        <p><strong>Creado:</strong> ${esc(quote.created_at ? new Date(quote.created_at).toLocaleString("es-ES") : "—")}</p>
        <p><strong>Válido hasta:</strong> ${esc(quote.valid_until ? new Date(quote.valid_until).toLocaleDateString("es-ES") : "Sin fecha límite")}</p>

        ${quote.conditions ? `<p><strong>Condiciones:</strong> ${esc(quote.conditions)}</p>` : ""}

        <label>
          Estado del presupuesto
          <select data-quote-status="${quoteId}">
            <option value="prepared" ${quote.status === "prepared" ? "selected" : ""}>Preparado</option>
            <option value="sent" ${quote.status === "sent" ? "selected" : ""}>Enviado</option>
            <option value="accepted" ${quote.status === "accepted" ? "selected" : ""}>Aceptado</option>
            <option value="rejected" ${quote.status === "rejected" ? "selected" : ""}>Rechazado</option>
            <option value="expired" ${quote.status === "expired" ? "selected" : ""}>Caducado</option>
          </select>
        </label>

        <div class="quote-actions">
          <button type="button" class="smallbtn" data-whatsapp-quote="${quoteId}">Preparar WhatsApp</button>
          <button type="button" class="smallbtn" data-email-quote="${quoteId}" ${reservation.email ? "" : "disabled"}>Preparar correo</button>
        </div>

        <div class="quote-message">
          <strong>Historial de mensajes:</strong>
          ${
            quoteMessages.length
              ? quoteMessages.map((message) => `
                <p>
                  ${esc(message.channel === "whatsapp" ? "WhatsApp" : "Correo")}
                  · ${esc(message.status || "—")}
                  · ${esc(message.created_at ? new Date(message.created_at).toLocaleString("es-ES") : "—")}
                </p>
              `).join("")
              : "<p>Sin mensajes preparados.</p>"
          }
          <p class="notice">El historial registra la preparación y apertura del mensaje, no confirma que se haya enviado.</p>
        </div>
      </article>
    `;
  }).join("");

  container.querySelectorAll("[data-quote-status]").forEach((select) => {
    select.addEventListener("change", async () => {
      const id = select.dataset.quoteStatus;

      const { error } = await sb
        .from("quotes")
        .update({
          status: select.value,
          updated_at: new Date().toISOString()
        })
        .eq("id", id);

      if (error) {
        showMessage(
          $("#admin-msg"),
          "No se pudo actualizar el presupuesto: " + error.message,
          true
        );
        return;
      }

      showMessage($("#admin-msg"), "Estado del presupuesto actualizado.");

      await loadQuotes();
      updateStats();
    });
  });

  container.querySelectorAll("[data-whatsapp-quote]").forEach((button) => {
    button.addEventListener("click", () => {
      openQuoteMessage(button.dataset.whatsappQuote, "whatsapp");
    });
  });

  container.querySelectorAll("[data-email-quote]").forEach((button) => {
    button.addEventListener("click", () => {
      openQuoteMessage(button.dataset.emailQuote, "email");
    });
  });
}

// PREPARE WHATSAPP OR EMAIL MESSAGE
async function openQuoteMessage(quoteId, channel) {
  const quote = quotes.find(
    (item) => String(item.id) === String(quoteId)
  );

  if (!quote) return;

  const { data: reservation, error } = await sb
    .from("reservations")
    .select("*")
    .eq("id", quote.reservation_id)
    .single();

  if (error || !reservation) {
    showMessage(
      $("#admin-msg"),
      "No se pudieron recuperar los datos de la reserva.",
      true
    );
    return;
  }

  const subject = "Presupuesto JONAS PREMIUM";

  const lines = [
    `Hola ${reservation.customer_name || ""},`,
    "",
    "Gracias por contactar con JONAS PREMIUM.",
    "",
    `Trayecto: ${reservation.origin || "—"} → ${reservation.destination || "—"}`,
    `Fecha: ${reservation.travel_date || "—"}`,
    `Hora: ${reservation.travel_time || "—"}`,
    "",
    `Presupuesto: ${money(quote.total, quote.currency || "EUR")}`
  ];

  if (quote.conditions) {
    lines.push("", `Condiciones: ${quote.conditions}`);
  }

  if (quote.valid_until) {
    lines.push(
      "",
      `Presupuesto válido hasta: ${new Date(quote.valid_until).toLocaleDateString("es-ES")}`
    );
  }

  lines.push(
    "",
    "Si estás conforme o necesitas alguna aclaración, puedes responder a este mensaje.",
    "",
    "JONAS PREMIUM",
    "Transporte ejecutivo"
  );

  const defaultMessage = lines.join("\n");

  const body = prompt(
    "Puedes revisar y modificar el mensaje antes de abrirlo:",
    defaultMessage
  );

  if (body === null) return;

  let url = "";
  let recipient = "";

  if (channel === "whatsapp") {
    recipient = digits(reservation.phone) || digits(WHATSAPP_NUMBER);

    if (!recipient) {
      showMessage(
        $("#admin-msg"),
        "No hay un número de teléfono disponible.",
        true
      );
      return;
    }

    url = `https://wa.me/${recipient}?text=${encodeURIComponent(body)}`;

  } else {
    recipient = reservation.email || "";

    if (!recipient) {
      showMessage(
        $("#admin-msg"),
        "Esta reserva no tiene correo electrónico.",
        true
      );
      return;
    }

    url = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  window.open(url, "_blank", "noopener,noreferrer");

  const { error: logError } = await sb
    .from("quote_messages")
    .insert({
      quote_id: quote.id,
      channel,
      recipient,
      subject: channel === "email" ? subject : null,
      message_body: body,
      status: "opened",
      sent_at: null
    });

  if (logError) {
    showMessage(
      $("#admin-msg"),
      "El mensaje se abrió, pero no se pudo guardar en el historial: " + logError.message,
      true
    );
    return;
  }

  showMessage(
    $("#admin-msg"),
    "Mensaje preparado y registrado. Recuerda enviarlo desde WhatsApp o tu correo."
  );

  await loadQuotes();
}

// AUTH STATE
if (sb) {
  sb.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session) {
      loginPanel?.classList.remove("hidden");
      dashboard?.classList.add("hidden");
    }
  });

  initialize();
}
