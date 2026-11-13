import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const form = document.querySelector("#booking-form");
const message = document.querySelector("#form-message");
const routePanel = document.querySelector("#route-price-panel");
const routeTitle = document.querySelector("#route-price-title");
const routeCopy = document.querySelector("#route-price-copy");
const originInput = document.querySelector("#origin");
const destinationInput = document.querySelector("#destination");

document.querySelector("#year").textContent = new Date().getFullYear();

const ready = typeof SUPABASE_URL === "string" && SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("TU-PROYECTO") && typeof SUPABASE_ANON_KEY === "string" &&
  SUPABASE_ANON_KEY.length > 20 && !SUPABASE_ANON_KEY.includes("TU_CLAVE");
const supabase = ready ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let pricingEnabled = false;
let pricingCurrency = "EUR";
let publicRoutes = [];
let pricingLoaded = false;
let pricingLoadFailed = false;

function normalizeLocation(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es");
}

function formatMoney(value, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(Number(value || 0));
}

function showRouteMessage(title, copy) {
  routeTitle.textContent = title;
  routeCopy.textContent = copy;
  routePanel.hidden = false;
}

async function loadPublicPricing() {
  if (!supabase) {
    pricingLoadFailed = true;
    pricingLoaded = true;
    return;
  }

  // Solo se consulta el indicador de publicación. Si no está habilitado,
  // no se descargan ni se muestran precios de rutas.
  const { data: publication, error: publicationError } = await supabase
    .from("pricing_settings")
    .select("pricing_enabled")
    .eq("id", 1)
    .maybeSingle();

  if (publicationError) {
    pricingLoadFailed = true;
    pricingLoaded = true;
    return;
  }

  pricingEnabled = publication?.pricing_enabled === true;
  if (!pricingEnabled) {
    pricingLoaded = true;
    return;
  }

  const { data: routeRows, error: routesError } = await supabase
    .from("fixed_routes")
    .select("origin,destination,price,description")
    .eq("is_active", true);

  if (routesError) {
    pricingLoadFailed = true;
    publicRoutes = [];
  } else {
    publicRoutes = routeRows || [];
  }
  pricingLoaded = true;
}

function findMatchingRoute() {
  if (!pricingEnabled || !pricingLoaded) return null;
  const origin = normalizeLocation(originInput.value);
  const destination = normalizeLocation(destinationInput.value);
  if (!origin || !destination) return null;
  return publicRoutes.find((route) =>
    normalizeLocation(route.origin) === origin &&
    normalizeLocation(route.destination) === destination
  ) || null;
}

function refreshRoutePrice() {
  if (!originInput.value.trim() || !destinationInput.value.trim()) {
    routePanel.hidden = true;
    return;
  }

  if (!pricingLoaded) {
    showRouteMessage("Consultando tarifas", "Estamos comprobando si existe una tarifa publicada para este trayecto.");
    return;
  }

  if (!pricingEnabled) {
    const detail = pricingLoadFailed
      ? "No podemos consultar ahora las tarifas publicadas. Puedes enviar tu solicitud y prepararemos un presupuesto personalizado."
      : "Las tarifas automáticas todavía no están publicadas. Puedes enviar tu solicitud y prepararemos un presupuesto personalizado.";
    showRouteMessage("Presupuesto personalizado", detail);
    return;
  }

  const route = findMatchingRoute();
  if (route) {
    showRouteMessage(
      `Tarifa fija publicada: ${formatMoney(route.price, pricingCurrency)}`,
      "Este es el precio registrado para el trayecto indicado. La solicitud seguirá pendiente de confirmación de disponibilidad por JONAS PREMIUM."
    );
  } else {
    showRouteMessage(
      "Solicita un presupuesto personalizado",
      "Todavía no hay una tarifa fija publicada para este trayecto. Envíanos la solicitud y revisaremos tu recorrido personalmente."
    );
  }
}

originInput.addEventListener("input", refreshRoutePrice);
destinationInput.addEventListener("input", refreshRoutePrice);

loadPublicPricing().then(() => {
  pricingLoaded = true;
  refreshRoutePrice();
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) {
    message.textContent = "La web está en modo demostración. Configura Supabase para activar el envío real.";
    return;
  }

  const d = Object.fromEntries(new FormData(form).entries());
  const matchedRoute = findMatchingRoute();
  const customerNotes = String(d.notes || "").trim();
  const priceNote = matchedRoute
    ? `Tarifa fija publicada mostrada al cliente: ${formatMoney(matchedRoute.price, pricingCurrency)} (${matchedRoute.origin} → ${matchedRoute.destination}). Pendiente de confirmación de disponibilidad.`
    : "";
  const notes = [customerNotes, priceNote].filter(Boolean).join("\n\n") || null;

  const payload = {
    service: d.service,
    origin: d.origin,
    destination: d.destination,
    travel_date: d.date,
    travel_time: d.time,
    passengers: Number(d.passengers),
    customer_name: d.name,
    phone: d.phone,
    email: d.email || null,
    notes,
    status: "pending"
  };

  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  button.textContent = "Enviando...";
  const { error } = await supabase.from("reservations").insert(payload);
  button.disabled = false;
  button.innerHTML = 'Enviar solicitud <span>↗</span>';

  if (error) {
    message.textContent = "No se pudo enviar la solicitud. Inténtalo de nuevo o contacta por WhatsApp.";
    console.error(error);
    return;
  }

  form.reset();
  routePanel.hidden = true;
  message.textContent = matchedRoute
    ? `Solicitud recibida. Hemos registrado la tarifa mostrada de ${formatMoney(matchedRoute.price, pricingCurrency)}; contactaremos contigo para confirmar disponibilidad.`
    : "Solicitud recibida. Contactaremos contigo para preparar un presupuesto personalizado y confirmar disponibilidad.";
});
