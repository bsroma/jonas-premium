# JONAS PREMIUM — web y panel básico

Web estática para GitHub Pages + Supabase. Proyecto independiente.

## 1. Configuración
1. Crea un proyecto Supabase nuevo, separado de cualquier otro proyecto.
2. En SQL Editor ejecuta `supabase.sql`.
3. En Authentication crea el usuario administrador con email y contraseña.
4. Copia el UUID de ese usuario desde Authentication > Users.
5. Ejecuta en SQL Editor: `insert into public.admin_users(user_id) values ('UUID_DEL_USUARIO_ADMIN');`
6. Copia `config.example.js` como `config.js` y completa URL y clave anon/publishable del proyecto.
7. No compartas ni uses la clave `service_role`. `config.js` está ignorado por Git.

## 2. Probar localmente
Desde la carpeta del proyecto:
`python -m http.server 8000`
Abre `http://localhost:8000`. (No abras index.html con doble clic: los módulos JavaScript necesitan servidor.)

## 3. Publicar gratis
1. Crea un repositorio GitHub nuevo, por ejemplo `jonas-premium`.
2. Sube todos los archivos, incluido `.github/workflows/deploy.yml`, pero NO `config.js`.
3. En el repositorio: Settings > Secrets and variables > Actions > Variables, crea:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
4. Edita el workflow para crear `config.js` antes de publicar, o como alternativa sencilla para la primera prueba, añade `config.js` localmente y súbelo al repositorio privado. **No recomendado para un repositorio público**, aunque la clave anon está diseñada para el navegador; la seguridad depende de RLS.
5. Settings > Pages > Build and deployment: selecciona GitHub Actions.

### Inyectar config.js desde GitHub Actions (recomendado)
Añade este paso antes de `actions/upload-pages-artifact@v3`:
```yaml
      - name: Create public Supabase config
        run: |
          cat > config.js <<EOF
          export const SUPABASE_URL = "${{ vars.SUPABASE_URL }}";
          export const SUPABASE_ANON_KEY = "${{ vars.SUPABASE_ANON_KEY }}";
          export const WHATSAPP_NUMBER = "34614180881";
          EOF
```
Define esas dos variables en Settings > Secrets and variables > Actions > Variables. La clave anon/publishable es pública por diseño; nunca uses service_role.

## 4. Uso
- Web pública: `/`
- Panel: `/admin.html`
- El formulario inserta solicitudes con estado `pending`.
- Panel permite login, filtrar, cambiar estado, contactar por WhatsApp y eliminar.
- Las reservas solo se leen/modifican desde cuentas añadidas a `admin_users`.

## 5. Límites y pendientes antes de producción
- WhatsApp actual es un enlace `wa.me` con texto inicial; **no es un bot IA**. Para automatización real se necesita WhatsApp Business Platform/Cloud API y un backend seguro (Edge Function u otro servidor), webhook, consentimiento y revisión de costes/condiciones.
- GitHub Pages no ejecuta backend. Supabase actúa como base de datos y autenticación.
- Añadir CAPTCHA/antispam y límites de envío antes de promocionar la web; una tabla pública de inserción puede recibir spam.
- Completar aviso legal, privacidad, cookies si se incorporan tecnologías que las requieran, identidad fiscal y dirección del responsable. La página legal incluida es solo plantilla.
- Reemplazar las fotos de muestra por imágenes propias/licenciadas del XPENG G6 gris y de Cantabria. Las fotos externas actuales son provisionales.
- Revisar accesibilidad, textos, RGPD y prueba integral antes de anunciarla.
