
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const form = document.querySelector("#booking-form");
const message = document.querySelector("#form-message");
const languageSelect = document.querySelector("#language-select");
const yearElement = document.querySelector("#year");

const translations = {
  es: {
    demo: "La web está en modo demostración. Configura Supabase para activar el envío real.",
    sending: "Enviando solicitud...",
    submit: "Enviar solicitud",
    error: "No se pudo enviar la solicitud. Inténtalo de nuevo o contacta por WhatsApp.",
    received: "¡Solicitud enviada correctamente!",
    receivedDetails: "Gracias por contactar con JONAS PREMIUM. Hemos recibido tu solicitud y revisaremos los detalles. Nos pondremos en contacto contigo para preparar un presupuesto personalizado y confirmar la disponibilidad."
  },
  en: {
    demo: "The website is in demonstration mode. Configure Supabase to activate real submissions.",
    sending: "Sending request...",
    submit: "Send request",
    error: "Your request could not be sent. Please try again or contact us via WhatsApp.",
    received: "Your request has been sent successfully!",
    receivedDetails: "Thank you for contacting JONAS PREMIUM. We have received your request and will review the details. We will contact you with a personalised quotation and confirm availability."
  },
  fr: {
    demo: "Le site est en mode démonstration. Configurez Supabase pour activer l'envoi réel.",
    sending: "Envoi de la demande...",
    submit: "Envoyer la demande",
    error: "Votre demande n'a pas pu être envoyée. Veuillez réessayer ou nous contacter par WhatsApp.",
    received: "Votre demande a bien été envoyée !",
    receivedDetails: "Merci d'avoir contacté JONAS PREMIUM. Nous avons reçu votre demande et allons examiner les détails. Nous vous contacterons pour préparer un devis personnalisé et confirmer les disponibilités."
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
}

if (languageSelect) {
  languageSelect.addEventListener("change", () => {
    applyLanguage(languageSelect.value);
  });
}

applyLanguage(getLanguage());

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

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

if (message) {
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabase) {
    if (message) {
      message.textContent = t("demo");
    }
    return;
  }

  const data = Object.fromEntries(new FormData(form).entries());

  const payload = {
    service: "Traslado privado",
    origin: String(data.origin || "").trim(),
    destination: String(data.destination || "").trim(),
    travel_date: data.date,
    travel_time: data.time,
    passengers: Number(data.passengers),
    customer_name: String(data.name || "").trim(),
    phone: String(data.phone || "").trim(),
    email: String(data.email || "").trim() || null,
    notes: String(data.notes || "").trim() || null,
    status: "pending"
  };

  const button = form.querySelector('button[type="submit"]');
  const originalButtonText = button?.innerHTML;

  if (message) {
    message.textContent = t("sending");
  }

  if (button) {
    button.disabled = true;
    button.textContent = t("sending");
  }

  try {
    const { error } = await supabase
      .from("reservations")
      .insert(payload);

    if (error) throw error;

    form.reset();

    if (message) {
      message.textContent = `${t("received")} ${t("receivedDetails")}`;
      message.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
    }
  } catch (error) {
    console.error("Error al enviar la solicitud:", error);

    if (message) {
      message.textContent = t("error");
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = originalButtonText || t("submit");
    }
  }
});
