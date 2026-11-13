import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY, WHATSAPP_NUMBER } from "./config.js";

const ready = typeof SUPABASE_URL === "string" && SUPABASE_URL.startsWith("https://") && typeof SUPABASE_ANON_KEY === "string" && SUPABASE_ANON_KEY.length > 20;
const sb = ready ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const money = (value, currency = "EUR") => new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(Number(value || 0));
const digits = (value) => String(value || "").replace(/\D/g, "");
let reservations = [];
let allReservations = [];
let routes = [];
let extras = [];
let quotes = [];
let settings = null;

const login = $("#login-panel");
const dashboard = $("#dashboard");
const loginMessage = $("#login-msg");

if (!ready) loginMessage.textContent = "No se encuentra la configuración de Supabase. Revisa config.js antes de utilizar el panel.";

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!sb) return;
  const form = new FormData(event.currentTarget);
  const { error } = await sb.auth.signInWithPassword({ email: form.get("email"), password: form.get("password") });
  loginMessage.textContent = error ? error.message : "";
  if (!error) await initialize();
});

$("#logout").addEventListener("click", async () => {
  await sb.auth.signOut();
  dashboard.classList.add("hidden");
  login.classList.remove("hidden");
});
$("#refresh-all").addEventListener("click", loadAll);
$("#filter").addEventListener("change", loadReservations);

document.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => showTab(button.dataset.tab)));
function showTab(name) {
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("hidden", panel.id !== `tab-${name}`));
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.style.borderColor = button.dataset.tab === name ? "#e63946" : "#d8d5d0";
    button.style.background = button.dataset.tab === name ? "#fff4f4" : "#fff";
  });
}

async function initialize() {
  if (!sb) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const { data: admin, error } = await sb.from("admin_users").select("user_id").eq("user_id", session.user.id).maybeSingle();
  if (error || !admin) {
    loginMessage.textContent = "Este usuario no tiene permisos de administrador.";
    await sb.auth.signOut();
    return;
  }
  login.classList.add("hidden");
  dashboard.classList.remove("hidden");
  showTab("reservations");
  await loadAll();
}

async function loadAll() {
  $("#admin-msg").textContent = "Actualizando…";
  const results = await Promise.all([loadReservations(), loadSettings(), loadRoutes(), loadExtras(), loadQuotes()]);
  const failed = results.some((result) => result === false);
  $("#admin-msg").textContent = failed ? "Algunos datos no se pudieron cargar. Comprueba las tablas y permisos RLS." : "Datos actualizados.";
}

async function loadReservations() {
  let query = sb.from("reservations").select("*").order("created_at", { ascending: false });
  const status = $("#filter").value;
  if (status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) { $("#reservations").innerHTML = `<p class="empty">No se pudieron cargar las solicitudes: ${esc(error.message)}</p>`; return false; }
  reservations = data || [];
  const allResult = await sb.from("reservations").select("id,customer_name,origin,destination,travel_date").order("created_at", { ascending: false });
  allReservations = allResult.data || reservations;
  populateReservationSelect();
  $("#reservations").innerHTML = reservations.map((reservation) => {
    const phone = digits(reservation.phone);
    const whatsapp = `https://wa.me/${phone}?text=${encodeURIComponent(`Hola ${reservation.customer_name}, te contactamos de JONAS PREMIUM por tu solicitud de ${reservation.origin} a ${reservation.destination}.`)}`;
    return `<article class="reservation"><div><strong>${esc(reservation.customer_name)} · ${esc(reservation.service)}</strong><p>${esc(reservation.travel_date)} · ${esc(String(reservation.travel_time || "").slice(0,5))} · ${esc(reservation.passengers)} pasajero(s)<br>${esc(reservation.origin)} → ${esc(reservation.destination)}<br>Tel. ${esc(reservation.phone)} · ${esc(reservation.email || "Sin email")}<br>${esc(reservation.notes || "Sin observaciones")}<br>Estado: <b>${esc(reservation.status)}</b></p></div><div class="reservation-actions"><select aria-label="Estado de solicitud" data-status="${esc(reservation.id)}"><option value="pending" ${reservation.status === "pending" ? "selected" : ""}>Pendiente</option><option value="confirmed" ${reservation.status === "confirmed" ? "selected" : ""}>Confirmada</option><option value="completed" ${reservation.status === "completed" ? "selected" : ""}>Completada</option><option value="cancelled" ${reservation.status === "cancelled" ? "selected" : ""}>Cancelada</option></select><a class="smallbtn" href="${whatsapp}" target="_blank" rel="noopener">WhatsApp</a><button class="smallbtn" type="button" data-create-quote="${esc(reservation.id)}">Preparar presupuesto</button></div></article>`;
  }).join("") || `<p class="empty">No hay solicitudes con este filtro.</p>`;
  $("#reservations").querySelectorAll("[data-status]").forEach((select) => select.addEventListener("change", async () => {
    const { error: updateError } = await sb.from("reservations").update({ status: select.value }).eq("id", select.dataset.status);
    if (updateError) alert(`No se pudo actualizar el estado: ${updateError.message}`);
    await loadReservations();
  }));
  $("#reservations").querySelectorAll("[data-create-quote]").forEach((button) => button.addEventListener("click", () => {
    $("#quote-reservation").value = button.dataset.createQuote;
    showTab("quotes");
    $("#quote-form").scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  return true;
}

async function loadSettings() {
  const { data, error } = await sb.from("pricing_settings").select("*").eq("id", 1).maybeSingle();
  if (error || !data) { $("#pricing-msg").textContent = error ? `No se pudo leer la configuración: ${error.message}` : "No existe la fila de configuración inicial."; return false; }
  settings = data;
  const form = $("#pricing-form");
  for (const key of ["currency", "base_price", "price_per_km", "price_per_minute", "minimum_price", "rounding_step"]) form.elements[key].value = data[key];
  form.elements.pricing_enabled.checked = Boolean(data.pricing_enabled);
  $("#engine-state").textContent = data.pricing_enabled ? "Motor activado" : "Motor desactivado";
  $("#engine-state").className = `status-pill ${data.pricing_enabled ? "good" : "off"}`;
  return true;
}

$("#pricing-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!settings) return;
  const form = new FormData(event.currentTarget);
  const payload = {
    currency: String(form.get("currency")),
    base_price: Number(form.get("base_price")),
    price_per_km: Number(form.get("price_per_km")),
    price_per_minute: Number(form.get("price_per_minute")),
    minimum_price: Number(form.get("minimum_price")),
    rounding_step: Number(form.get("rounding_step")),
    pricing_enabled: false,
    updated_at: new Date().toISOString()
  };
  if (Object.values(payload).some((value) => typeof value === "number" && (!Number.isFinite(value) || value < 0)) || payload.rounding_step <= 0) {
    $("#pricing-msg").textContent = "Revisa los importes: deben ser números válidos y el redondeo debe ser mayor que cero."; return;
  }
  const { error } = await sb.from("pricing_settings").update(payload).eq("id", 1);
  $("#pricing-msg").textContent = error ? `No se pudo guardar: ${error.message}` : "Configuración guardada. El motor continúa desactivado.";
  await loadSettings();
});

async function loadRoutes() {
  const { data, error } = await sb.from("fixed_routes").select("*").order("origin", { ascending: true });
  if (error) { $("#routes-list").innerHTML = `<p class="empty">No se pudieron cargar las rutas: ${esc(error.message)}</p>`; return false; }
  routes = data || [];
  $("#routes-list").innerHTML = routes.map((route) => `<article class="data-card"><div><strong>${esc(route.origin)} → ${esc(route.destination)}</strong><p>${money(route.price)} · ${esc(route.description || "Sin descripción")}<br><span class="status-pill ${route.is_active ? "good" : "off"}">${route.is_active ? "Activa" : "Inactiva"}</span></p></div><div class="data-actions"><button class="smallbtn" data-edit-route="${esc(route.id)}">Editar</button><button class="smallbtn" data-toggle-route="${esc(route.id)}">${route.is_active ? "Desactivar" : "Activar"}</button></div></article>`).join("") || `<p class="empty">Todavía no has creado tarifas fijas. Puedes añadirlas cuando tengas los precios validados.</p>`;
  $("#routes-list").querySelectorAll("[data-edit-route]").forEach((button) => button.addEventListener("click", () => editRoute(button.dataset.editRoute)));
  $("#routes-list").querySelectorAll("[data-toggle-route]").forEach((button) => button.addEventListener("click", () => toggleRoute(button.dataset.toggleRoute)));
  return true;
}
function editRoute(id) {
  const route = routes.find((item) => item.id === id); if (!route) return;
  const form = $("#route-form");
  form.elements.route_id.value = route.id;
  form.elements.origin.value = route.origin;
  form.elements.destination.value = route.destination;
  form.elements.price.value = route.price;
  form.elements.description.value = route.description || "";
  form.elements.is_active.checked = Boolean(route.is_active);
  $("#route-form-title").textContent = "Editar tarifa fija";
  $("#route-cancel-edit").classList.remove("hidden");
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}
function resetRouteForm() {
  $("#route-form").reset(); $("#route-form").elements.route_id.value = "";
  $("#route-form-title").textContent = "Añadir tarifa fija"; $("#route-cancel-edit").classList.add("hidden");
}
$("#route-cancel-edit").addEventListener("click", resetRouteForm);
$("#route-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  const payload = { origin: String(values.get("origin")).trim(), destination: String(values.get("destination")).trim(), price: Number(values.get("price")), description: String(values.get("description") || "").trim() || null, is_active: values.get("is_active") === "on", updated_at: new Date().toISOString() };
  if (!payload.origin || !payload.destination || !Number.isFinite(payload.price) || payload.price <= 0) { $("#routes-msg").textContent = "Completa origen, destino y un precio superior a cero."; return; }
  const id = String(values.get("route_id") || "");
  const result = id ? await sb.from("fixed_routes").update(payload).eq("id", id) : await sb.from("fixed_routes").insert(payload);
  $("#routes-msg").textContent = result.error ? `No se pudo guardar: ${result.error.message}` : "Tarifa guardada correctamente.";
  if (!result.error) { resetRouteForm(); await loadRoutes(); }
});
async function toggleRoute(id) {
  const route = routes.find((item) => item.id === id); if (!route) return;
  const { error } = await sb.from("fixed_routes").update({ is_active: !route.is_active, updated_at: new Date().toISOString() }).eq("id", id);
  $("#routes-msg").textContent = error ? `No se pudo actualizar: ${error.message}` : "Estado de la tarifa actualizado.";
  await loadRoutes();
}

async function loadExtras() {
  const { data, error } = await sb.from("pricing_extras").select("*").order("name", { ascending: true });
  if (error) { $("#extras-list").innerHTML = `<p class="empty">No se pudieron cargar los suplementos: ${esc(error.message)}</p>`; return false; }
  extras = data || [];
  $("#extras-list").innerHTML = extras.map((extra) => `<form class="data-card extra-form" data-extra-form="${esc(extra.id)}"><div><strong>${esc(extra.name)}</strong><p>${esc(extra.description || "")}<br>Tipo: ${extra.calculation_type === "percentage" ? "Porcentaje (%)" : "Importe fijo (€)"}</p></div><div class="data-actions"><label class="notice">Importe<input name="amount" type="number" min="0" step="0.01" value="${esc(extra.amount)}" required style="width:105px;padding:8px;border:1px solid #ddd"></label><label class="toggle-line"><input name="is_active" type="checkbox" ${extra.is_active ? "checked" : ""}> Activo</label><button class="smallbtn" type="submit">Guardar</button></div></form>`).join("") || `<p class="empty">No hay suplementos configurados.</p>`;
  $("#extras-list").querySelectorAll("[data-extra-form]").forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = new FormData(form); const amount = Number(values.get("amount"));
    if (!Number.isFinite(amount) || amount < 0) { $("#extras-msg").textContent = "Introduce un importe válido."; return; }
    const { error: updateError } = await sb.from("pricing_extras").update({ amount, is_active: values.get("is_active") === "on", updated_at: new Date().toISOString() }).eq("id", form.dataset.extraForm);
    $("#extras-msg").textContent = updateError ? `No se pudo guardar: ${updateError.message}` : "Suplemento actualizado.";
    if (!updateError) await loadExtras();
  }));
  return true;
}

async function loadQuotes() {
  const { data, error } = await sb.from("quotes").select("*").order("created_at", { ascending: false });
  if (error) { $("#quotes-list").innerHTML = `<p class="empty">No se pudieron cargar los presupuestos: ${esc(error.message)}</p>`; return false; }
  quotes = data || [];
  const reservationIds = [...new Set(quotes.map((quote) => quote.reservation_id).filter(Boolean))];
  let related = [];
  if (reservationIds.length) {
    const { data: relatedData } = await sb.from("reservations").select("id,customer_name,origin,destination,travel_date,phone,email").in("id", reservationIds);
    related = relatedData || [];
  }
  const byId = new Map(related.map((item) => [item.id, item]));
  const quoteIds = quotes.map((quote) => quote.id);
  let messageRows = [];
  if (quoteIds.length) {
    const { data: messageData, error: messageError } = await sb.from("quote_messages").select("*").in("quote_id", quoteIds).order("created_at", { ascending: false });
    if (messageError) { $("#quotes-list").innerHTML = `<p class="empty">Los presupuestos se han cargado, pero no se pudo leer el historial de mensajes: ${esc(messageError.message)}</p>`; return false; }
    messageRows = messageData || [];
  }
  const messagesByQuote = new Map();
  for (const row of messageRows) {
    if (!messagesByQuote.has(row.quote_id)) messagesByQuote.set(row.quote_id, []);
    messagesByQuote.get(row.quote_id).push(row);
  }
  $("#quotes-list").innerHTML = quotes.map((quote) => {
    const reservation = byId.get(quote.reservation_id) || {};
    const history = messagesByQuote.get(quote.id) || [];
    const historyText = history.length ? history.map((message) => `${message.channel === "whatsapp" ? "WhatsApp" : "Correo"} · ${message.status} · ${new Date(message.created_at).toLocaleString("es-ES")}`).join("<br>") : "Todavía no hay mensajes preparados.";
    return `<article class="data-card"><div><strong>${esc(reservation.customer_name || "Cliente")} · ${esc(reservation.origin || "Origen")} → ${esc(reservation.destination || "Destino")}</strong><p>${money(quote.total, quote.currency)} · ${esc(quote.pricing_type)} · ${esc(quote.status)}<br>Creado: ${esc(new Date(quote.created_at).toLocaleString("es-ES"))}<br>${esc(quote.conditions || "Sin condiciones adicionales")}<br><b>Historial de mensajes:</b><br>${historyText}</p><div class="inline-status"><select data-quote-status="${esc(quote.id)}"><option value="draft" ${quote.status === "draft" ? "selected" : ""}>Borrador</option><option value="prepared" ${quote.status === "prepared" ? "selected" : ""}>Preparado</option><option value="sent" ${quote.status === "sent" ? "selected" : ""}>Enviado</option><option value="accepted" ${quote.status === "accepted" ? "selected" : ""}>Aceptado</option><option value="rejected" ${quote.status === "rejected" ? "selected" : ""}>Rechazado</option><option value="expired" ${quote.status === "expired" ? "selected" : ""}>Caducado</option></select></div></div><div class="data-actions"><button class="smallbtn" data-whatsapp-quote="${esc(quote.id)}">Preparar WhatsApp</button><button class="smallbtn" data-email-quote="${esc(quote.id)}" ${reservation.email ? "" : "disabled"}>Preparar correo</button></div></article>`;
  }).join("") || `<p class="empty">Todavía no hay presupuestos. Puedes crear uno desde una solicitud o desde el formulario superior.</p>`;
  $("#quotes-list").querySelectorAll("[data-quote-status]").forEach((select) => select.addEventListener("change", async () => {
    const { error: updateError } = await sb.from("quotes").update({ status: select.value, updated_at: new Date().toISOString() }).eq("id", select.dataset.quoteStatus);
    if (updateError) alert(`No se pudo actualizar el presupuesto: ${updateError.message}`);
    await loadQuotes();
  }));
  $("#quotes-list").querySelectorAll("[data-whatsapp-quote]").forEach((button) => button.addEventListener("click", () => openQuoteMessage(button.dataset.whatsappQuote, "whatsapp")));
  $("#quotes-list").querySelectorAll("[data-email-quote]").forEach((button) => button.addEventListener("click", () => openQuoteMessage(button.dataset.emailQuote, "email")));
  populateReservationSelect();
  return true;
}
function populateReservationSelect() {
  const select = $("#quote-reservation");
  const current = select.value;
  select.innerHTML = `<option value="">Selecciona una solicitud</option>` + allReservations.map((item) => `<option value="${esc(item.id)}">${esc(item.customer_name)} · ${esc(item.origin)} → ${esc(item.destination)} · ${esc(item.travel_date)}</option>`).join("");
  if (current && allReservations.some((item) => item.id === current)) select.value = current;
}

$("#quote-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = new FormData(event.currentTarget);
  const reservationId = String(values.get("reservation_id") || "");
  const total = Number(values.get("total"));
  if (!reservationId || !Number.isFinite(total) || total <= 0) { $("#quote-msg").textContent = "Selecciona una solicitud e introduce un importe superior a cero."; return; }
  const reservation = reservations.find((item) => item.id === reservationId);
  if (!reservation) { $("#quote-msg").textContent = "No se encuentra la solicitud seleccionada. Actualiza los datos e inténtalo de nuevo."; return; }
  const currency = settings?.currency || "EUR";
  const validUntil = values.get("valid_until");
  const payload = {
    reservation_id: reservationId,
    status: "prepared",
    pricing_type: String(values.get("pricing_type")),
    currency,
    subtotal: total,
    extras_total: 0,
    total,
    distance_km: null,
    duration_minutes: null,
    pricing_snapshot: { method: "manual_admin_quote", currency, total, created_at: new Date().toISOString(), reservation: { origin: reservation.origin, destination: reservation.destination } },
    conditions: String(values.get("conditions") || "").trim() || null,
    valid_until: validUntil ? new Date(`${validUntil}T23:59:59`).toISOString() : null,
    updated_at: new Date().toISOString()
  };
  const { error } = await sb.from("quotes").insert(payload);
  $("#quote-msg").textContent = error ? `No se pudo guardar el presupuesto: ${error.message}` : "Presupuesto guardado. Puedes preparar el mensaje para el cliente desde el historial.";
  if (!error) { event.currentTarget.reset(); await loadQuotes(); }
});

async function openQuoteMessage(quoteId, channel) {
  const quote = quotes.find((item) => item.id === quoteId); if (!quote) return;
  const { data: reservation, error } = await sb.from("reservations").select("*").eq("id", quote.reservation_id).single();
  if (error || !reservation) { alert("No se pudieron recuperar los datos de la solicitud asociada."); return; }
  const greeting = `Hola ${reservation.customer_name},`;
  const lines = [greeting, "", "Gracias por contactar con JONAS PREMIUM.", `Servicio: ${reservation.service}`, `Trayecto: ${reservation.origin} → ${reservation.destination}`, `Fecha: ${reservation.travel_date} · Hora: ${String(reservation.travel_time || "").slice(0,5)}`, `Presupuesto: ${money(quote.total, quote.currency)}`];
  if (quote.conditions) lines.push(`Condiciones: ${quote.conditions}`);
  if (quote.valid_until) lines.push(`Oferta válida hasta: ${String(quote.valid_until).slice(0,10)}`);
  lines.push("", "Quedamos a tu disposición para cualquier consulta.", "JONAS PREMIUM · Transporte Ejecutivo", WHATSAPP_NUMBER || "");
  const suggestedBody = lines.filter(Boolean).join("\n");
  const body = window.prompt("Puedes revisar y editar el mensaje antes de abrir la aplicación:", suggestedBody);
  if (body === null) return;
  const subject = `Presupuesto JONAS PREMIUM · ${reservation.origin} - ${reservation.destination}`;
  const recipient = channel === "whatsapp" ? (digits(reservation.phone) || digits(WHATSAPP_NUMBER)) : String(reservation.email || "");
  if (channel === "whatsapp" && !recipient) { alert("La solicitud no tiene un teléfono válido."); return; }
  if (channel === "email" && !recipient) { alert("La solicitud no tiene correo electrónico."); return; }
  const target = channel === "whatsapp" ? `https://wa.me/${recipient}?text=${encodeURIComponent(body)}` : `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(target, "_blank", "noopener,noreferrer");
  const { error: insertError } = await sb.from("quote_messages").insert({ quote_id: quote.id, channel, recipient, subject: channel === "email" ? subject : null, message_body: body, status: "opened", sent_at: null });
  if (insertError) alert(`Se abrió el mensaje, pero no se pudo guardar en el historial: ${insertError.message}`);
  else {
    // "opened" solo registra que se abrió WhatsApp/correo; el envío lo confirma el administrador fuera de esta web.
    await loadQuotes();
  }
}

sb?.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") { dashboard.classList.add("hidden"); login.classList.remove("hidden"); }
});
initialize();
