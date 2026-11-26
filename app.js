
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const form = document.querySelector("#booking-form");
const message = document.querySelector("#form-message");
const languageSelect = document.querySelector("#language-select");
const yearElement = document.querySelector("#year");

const translations = {
  es: {
    demo: "La web está en modo demostración. Configura Supabase para activar el envío real.",
    sending: "Enviando...",
    submit: "Enviar solicitud",
    error: "No se pudo enviar la solicitud. Inténtalo de nuevo o contacta por WhatsApp.",
    received: "Solicitud recibida correctamente. Contactaremos contigo para preparar un presupuesto personalizado y confirmar la disponibilidad."
  },
  en: {
    demo: "The website is in demonstration mode. Configure Supabase to activate real submissions.",
    sending: "Sending...",
    submit: "Send request",
    error: "Your request could not be sent. Please try again or contact us via WhatsApp.",
    received: "Your request has been received. We will contact you with a personalised quotation and confirm availability."
  },
  fr: {
    demo: "Le site est en mode démonstration. Configurez Supabase pour activer l'envoi réel.",
    sending: "Envoi en cours...",
    submit: "Envoyer la demande",
    error: "Votre demande n'a pas pu être envoyée. Veuillez réessayer ou nous contacter par WhatsApp.",
    received: "Votre demande a bien été reçue. Nous vous contacterons pour préparer un devis personnalisé et confirmer les disponibilités."
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

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabase) {
    if (message) message.textContent = t("demo");
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
      message.textContent = t("received");
    }
  } catch (error) {
    console.error("Error al enviar la solicitud:", error);

    if (message) {
      message.textContent = t("error");
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = originalButtonText || `${t("submit")} <span>↗</span>`;
    }
  }
});

      ? `${t("receivedFixed")} ${formatMoney(matchedRoute.price, pricingCurrency)}. ${t("pending")}`
      : t("receivedCustom");
  }
});
