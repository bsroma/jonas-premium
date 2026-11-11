import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
const form=document.querySelector("#booking-form"), message=document.querySelector("#form-message");
document.querySelector("#year").textContent=new Date().getFullYear();
const ready=SUPABASE_URL.startsWith("https://")&&!SUPABASE_URL.includes("TU-PROYECTO")&&SUPABASE_ANON_KEY.length>20&&!SUPABASE_ANON_KEY.includes("TU_CLAVE");
const supabase=ready?createClient(SUPABASE_URL,SUPABASE_ANON_KEY):null;
form?.addEventListener("submit",async e=>{
 e.preventDefault(); if(!supabase){message.textContent="La web está en modo demostración. Configura Supabase para activar el envío real.";return;}
 const d=Object.fromEntries(new FormData(form).entries());
 const payload={service:d.service,origin:d.origin,destination:d.destination,travel_date:d.date,travel_time:d.time,passengers:Number(d.passengers),customer_name:d.name,phone:d.phone,email:d.email||null,notes:d.notes||null,status:"pending"};
 const button=form.querySelector("button[type=submit]");button.disabled=true;button.textContent="Enviando...";
 const {error}=await supabase.from("reservations").insert(payload);
 button.disabled=false;button.innerHTML='Enviar solicitud <span>↗</span>';
 if(error){message.textContent="No se pudo enviar la solicitud. Inténtalo de nuevo o contacta por WhatsApp.";console.error(error);return;}
 form.reset();message.textContent="Solicitud recibida. Contactaremos contigo para confirmar disponibilidad y presupuesto.";
});
