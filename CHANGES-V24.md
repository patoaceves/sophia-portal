# SOPHIA Portal · v24 — CSP permite embeds de YouTube/Vimeo/Google Forms

## El bug

Las lecciones tipo `video` con URLs de YouTube renderean el iframe
correctamente, pero el navegador lo bloquea con:

> "This content is blocked. Contact the site owner to fix the issue."

(El placeholder gris con el ícono de archivo roto y ese mensaje encima.)

## Causa raíz

`vercel.json` tiene una **Content Security Policy** estricta. El default
era:

```
default-src 'self'; script-src 'self' 'unsafe-inline' https://esm.sh; ...
```

**No incluía `frame-src`**, así que cae al `default-src 'self'`, lo que
significa: solo se permiten iframes del mismo origen (`portal.sophiamx.org`).
Cualquier iframe externo (YouTube, Vimeo, Google Forms) se bloquea por CSP.

## Fix

Agregada la directiva `frame-src` a la CSP del portal con los dominios
permitidos para embed de video / formularios:

- `https://www.youtube.com` — embeds estándar de YouTube
- `https://www.youtube-nocookie.com` — modo privacy-enhanced de YouTube
- `https://youtube.com` — fallback sin www
- `https://player.vimeo.com` — embeds de Vimeo (por si los usamos)
- `https://docs.google.com` — Google Forms / Docs preview (para tipo `enlace`)

También agregué a `img-src`:
- `https://i.ytimg.com` y `https://img.youtube.com` — thumbnails de YouTube

(El player de YouTube intenta precargar el thumbnail antes de que se
reproduzca el video; si `img-src` no lo permite, se ve un placeholder.)

## Archivos modificados

- `vercel.json` — bloque CSP en `headers[0]` (path `/(.*)`)

El header de `/embed/(.*)` no se tocó: sigue siendo estricto porque
esas páginas se incrustan en GHL y no tienen necesidad de embeds externos.

## Deploy

**Requiere redeploy en Vercel** — los headers se aplican en respuesta HTTP
desde el edge de Vercel, no son cosa de JS. Después del deploy, hard
refresh (Cmd+Shift+R) para que el navegador descargue los nuevos headers.

## Consideraciones de seguridad

`frame-src` con dominios externos *aumenta* la superficie de ataque, pero
el riesgo es bajo:
- YouTube/Vimeo no pueden ejecutar JS contra portal.sophiamx.org desde
  dentro de un iframe (la sandbox del iframe lo previene)
- Los dominios listados son providers de confianza, no `*` ni dominios random
- `frame-ancestors 'none'` sigue impidiendo que OTROS sitios embeban
  el portal en SUS iframes (clickjacking protection intacta)
