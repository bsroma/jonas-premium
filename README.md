# JONAS PREMIUM — web y panel de administración

Web estática para GitHub Pages + Supabase. Proyecto independiente.

## Configuración existente

- Web pública: `index.html`.
- Panel privado: `admin.html`.
- Cliente Supabase: `config.js` (solo URL y clave pública/publishable; nunca incluir `service_role` ni `sb_secret`).
- Los permisos reales se aplican en Supabase mediante RLS y la tabla `admin_users`.

## Panel de administración actualizado

Después de iniciar sesión con un usuario autorizado en `admin_users`, el panel permite:

- Consultar solicitudes, cambiar sus estados y abrir WhatsApp con un mensaje inicial.
- Modificar la configuración general de tarifas. El panel fuerza `pricing_enabled = false` durante esta fase.
- Crear, editar, activar y desactivar tarifas fijas por trayecto.
- Modificar importes y activar/desactivar suplementos.
- Crear presupuestos manuales asociados a solicitudes, mantener su historial y cambiar su estado.
- Preparar mensajes de WhatsApp y correo. La web abre el enlace prellenado; el administrador debe revisar y pulsar Enviar en la aplicación correspondiente.

Las solicitudes ya no tienen botón de borrado definitivo en el panel; se pueden cancelar para conservar su historial.

## Publicación

1. Conserva una copia de seguridad de los archivos actuales.
2. Sube los archivos actualizados a la raíz del repositorio GitHub Pages, sustituyendo `admin.html`, `admin.js` y `README.md` y añadiendo `config.js` solo si tu repositorio aún no lo tiene.
3. Mantén `index.html`, `app.js`, `styles.css`, `privacidad.html`, el workflow y los demás archivos existentes. Esta actualización no necesita cambiar el formulario público.
4. Espera a que termine la acción de GitHub Pages y abre `/admin.html`.
5. Prueba cada apartado con tu cuenta administradora.

## Importante sobre el envío de mensajes

Abrir WhatsApp o el cliente de correo con un texto preparado no equivale a enviarlo. El historial registra que el enlace se abrió; solo el administrador puede completar el envío desde WhatsApp o su correo. No se envían mensajes automáticamente.

## Seguridad y límites pendientes

- La clave anon/publishable está diseñada para el navegador, pero toda protección de datos depende de RLS y permisos correctos. Nunca publiques claves `service_role`, `sb_secret`, contraseñas ni tokens.
- El motor de cálculo automático de precios sigue desactivado. Esta versión no calcula rutas, distancia ni tiempo real y no muestra precios automáticos al cliente.
- Los precios fijos y suplementos son configurables en el panel, pero todavía no se aplican al formulario público ni al cálculo de presupuestos.
- Las tablas nuevas (`pricing_settings`, `fixed_routes`, `pricing_extras`, `quotes`, `quote_messages`) deben existir y tener las políticas RLS creadas en Supabase.
- Antes de promocionar la web, completar aviso legal/privacidad, añadir protección antispam y realizar una prueba integral.
