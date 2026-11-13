
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const form = document.querySelector("#booking-form");
const message = document.querySelector("#form-message");
const routePanel = document.querySelector("#route-price-panel");
const routeTitle = document.querySelector("#route-price-title");
const routeCopy = document.querySelector("#route-price-copy");
const originInput = document.querySelector("#origin");
const destinationInput = document.querySelector("#destination");
const languageSelect = document.querySelector("#language-select");

const translations = {
  es: {
    loading: "Consultando tarifas",
    checking: "Estamos comprobando si existe una tarifa publicada para este trayecto.",
    custom: "Presupuesto personalizado",
    unavailable: "No podemos consultar ahora las tarifas publicadas. Puedes enviar tu solicitud y prepararemos un presupuesto personalizado.",
    unpublished: "Las tarifas automáticas todavía no están publicadas. Puedes enviar tu solicitud y prepararemos un presupuesto personalizado.",
    fixed: "Tarifa fija publicada",
    fixedInfo: "Este es el precio registrado para el trayecto indicado. La solicitud seguirá pendiente de confirmación de disponibilidad por JONAS PREMIUM.",
    requestQuote: "Solicita un presupuesto personalizado",
    noRoute: "Todavía no hay una tarifa fija publicada para este trayecto. Envíanos la solicitud y revisaremos tu recorrido personalmente.",
    demo: "La web está en modo demostración. Configura Supabase para activar el envío real.",
    sending: "Enviando...",
    submit: "Enviar solicitud",
    error: "No se pudo enviar la solicitud. Inténtalo de nuevo o contacta por WhatsApp.",
    receivedFixed: "Solicitud recibida. Hemos registrado la tarifa mostrada de",
    receivedCustom: "Solicitud recibida. Contactaremos contigo para preparar un presupuesto personalizado y confirmar disponibilidad.",
    pending: "Contactaremos contigo para confirmar disponibilidad."
  },
  en: {
    loading: "Checking fares",
    checking: "We are checking whether a published fare is available for this journey.",
    custom: "Personalised quotation",
    unavailable: "We cannot check published fares right now. You can submit your request and we will prepare a personalised quotation.",
    unpublished: "Automatic fares have not been published yet. You can submit your request and we will prepare a personalised quotation.",
    fixed: "Published fixed fare",
    fixedInfo: "This is the registered price for the journey shown. The request remains subject to availability confirmation by JONAS PREMIUM.",
    requestQuote: "Request a personalised quotation",
    noRoute: "There is no published fixed fare for this journey yet. Send us your request and we will review your route personally.",
    demo: "The website is in demonstration mode. Configure Supabase to activate real submissions.",
    sending: "Sending...",
    submit: "Send request",
    error: "Your request could not be sent. Please try again or contact us via WhatsApp.",
    receivedFixed: "Request received. We have recorded the displayed fare of",
    receivedCustom: "Request received. We will contact you to prepare a personalised quotation and confirm availability.",
    pending: "We will contact you to confirm availability."
  },
  fr: {
    loading: "Vérification des tarifs",
    checking: "Nous vérifions si un tarif publié existe pour ce trajet.",
    custom: "Devis personnalisé",
    unavailable: "Nous ne pouvons pas consulter les tarifs publiés pour le moment. Vous pouvez envoyer votre demande et nous préparerons un devis personnalisé.",
    unpublished: "Les tarifs automatiques ne sont pas encore publiés. Vous pouvez envoyer votre demande et nous préparerons un devis personnalisé.",
    fixed: "Tarif fixe publié",
    fixedInfo: "Il s'agit du prix enregistré pour le trajet indiqué. La demande reste soumise à la confirmation des disponibilités par JONAS PREMIUM.",
    requestQuote: "Demander un devis personnalisé",
    noRoute: "Aucun tarif fixe n'est encore publié pour ce trajet. Envoyez-nous votre demande et nous étudierons personnellement votre itinéraire.",
    demo: "Le site est en mode démonstration. Configurez Supabase pour activer l'envoi réel.",
    sending: "Envoi en cours...",
    submit: "Envoyer la demande",
    error: "Votre demande n'a pas pu être envoyée. Veuillez réessayer ou nous contacter par WhatsApp.",
    receivedFixed: "Demande reçue. Nous avons enregistré le tarif affiché de",
    receivedCustom: "Demande reçue. Nous vous contacterons pour préparer un devis personnalisé et confirmer les disponibilités.",
    pending: "Nous vous contacterons pour confirmer les disponibilités."
  }
};

let currentLanguage = "es";

function getLanguage() {
  const saved = localStorage.getItem("jonas-language");
  return translations[saved] ? saved : "es";
}

function t(key) {
  return translations[currentLanguage][key] || translations.es[key] || key;
}

function applyLanguage(language) {
  currentLanguage = translations[language] ? language : "es";
  document.documentElement.lang = currentLanguage;

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (translations[currentLanguage][key]) {
      element.textContent = translations[currentLanguage][key];
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const key = element.dataset.i18nPlaceholder;
    if (translations[currentLanguage][key]) {
      element.placeholder = translations[currentLanguage][key];
    }
  });

  if (languageSelect) {
    languageSelect.value = currentLanguage;
  }

  localStorage.setItem("jonas-language", currentLanguage);

  if (originInput?.value.trim() && destinationInput?.value.trim()) {
    refreshRoutePrice();
  }
}

if (languageSelect) {
  languageSelect.addEventListener("change", () => {
    applyLanguage(languageSelect.value);
  });
}

applyLanguage(getLanguage());

const yearElement = document.querySelector("#year");
if (yearElement) yearElement.textContent = new Date().getFullYear();

const ready =
  typeof SUPABASE_URL === "string" &&
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("TU-PROYECTO") &&
  typeof SUPABASE_ANON_KEY === "string" &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_ANON_KEY.includes("TU_CLAVE");

const supabase = ready
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

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
  const locales = {
    es: "es-ES",
    en: "en-GB",
    fr: "fr-FR"
  };

  return new Intl.NumberFormat(locales[currentLanguage], {
    style: "currency",
    currency
  }).format(Number(value || 0));
}

function showRouteMessage(title, copy) {
  if (!routeTitle || !routeCopy || !routePanel) return;

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

  // Solo se consulta el indicador de publicación.
  // Si no está habilitado, no se descargan ni muestran precios de rutas.
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

  const origin = normalizeLocation(originInput?.value);
  const destination = normalizeLocation(destinationInput?.value);

  if (!origin || !destination) return null;

  return publicRoutes.find((route) =>
    normalizeLocation(route.origin) === origin &&
    normalizeLocation(route.destination) === destination
  ) || null;
}

function refreshRoutePrice() {
  if (!originInput?.value.trim() || !destinationInput?.value.trim()) {
    if (routePanel) routePanel.hidden = true;
    return;
  }

  if (!pricingLoaded) {
    showRouteMessage(t("loading"), t("checking"));
    return;
  }

  if (!pricingEnabled) {
    const detail = pricingLoadFailed
      ? t("unavailable")
      : t("unpublished");

    showRouteMessage(t("custom"), detail);
    return;
  }

  const route = findMatchingRoute();

  if (route) {
    showRouteMessage(
      `${t("fixed")}: ${formatMoney(route.price, pricingCurrency)}`,
      t("fixedInfo")
    );
  } else {
    showRouteMessage(t("requestQuote"), t("noRoute"));
  }
}

originInput?.addEventListener("input", refreshRoutePrice);
destinationInput?.addEventListener("input", refreshRoutePrice);

loadPublicPricing().then(() => {
  pricingLoaded = true;
  refreshRoutePrice();
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabase) {
    if (message) message.textContent = t("demo");
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

  if (button) {
    button.disabled = true;
    button.textContent = t("sending");
  }

  const { error } = await supabase
    .from("reservations")
    .insert(payload);

  if (button) {
    button.disabled = false;
    button.innerHTML = `${t("submit")} <span>↗</span>`;
  }

  if (error) {
    if (message) message.textContent = t("error");
    console.error(error);
    return;
  }

  form.reset();

  if (routePanel) routePanel.hidden = true;

  if (message) {
    message.textContent = matchedRoute
      ? `${t("receivedFixed")} ${formatMoney(matchedRoute.price, pricingCurrency)}. ${t("pending")}`
      : t("receivedCustom");
  }
});
