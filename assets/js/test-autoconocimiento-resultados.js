// SOPHIA Portal · Resultados de la Autoevaluación VIA Autoconocimiento.
//
// Visualización:
//   - Top 5 "Fortalezas firma" (cards con fortaleza, virtud, score)
//   - Lista ranked completa de las 24 fortalezas (barras horizontales,
//     color por virtud)
//   - Panel de las 6 virtudes con su promedio
//   - Análisis textual personalizado por virtud (Alto / Medio / Bajo)
//   - Pregunta de reflexión para journaling

import { requireAuth } from "./auth.js";
import { api } from "./api.js";
import { renderShell, escapeHtml } from "./ui-shell.js";
import { loaderHtml, startLoaderRotation } from "./loader.js";
import { icon } from "./icons.js";

// Color por virtud (paleta consistente con la rueda de felicidad pero
// distinta: aquí lo organizamos por la clasificación VIA, no por el
// modelo SOPHIA). Usamos tonos suaves para que las 24 barras no agredan
// visualmente.
const VIRTUD_COLORS = {
  sabiduria:     "#66a3f4",  // azul (mismo del pilar autoconocimiento)
  coraje:        "#d21744",  // rojo
  humanidad:     "#e3a52d",  // ámbar
  justicia:      "#8d9438",  // verde olivo
  moderacion:    "#7a5fb8",  // morado
  trascendencia: "#3a9c8c",  // verde turquesa
};

const VIRTUD_LABELS = {
  sabiduria:     "Sabiduría y Conocimiento",
  coraje:        "Coraje",
  humanidad:     "Humanidad",
  justicia:      "Justicia",
  moderacion:    "Moderación",
  trascendencia: "Trascendencia",
};

(async () => {
  const persona = await requireAuth();
  if (!persona) return;

  const params = new URLSearchParams(location.search);
  const respuestaId = params.get("id");
  const cursoSlug = params.get("slug") || "";

  renderShell({
    persona,
    title: "Resultados · Autoevaluación VIA",
    activePath: "/app/cursos",
    contentHtml: loaderHtml({ context: "resultados" }),
  });
  const stopLoader = startLoaderRotation();

  try {
    const data = await api.resultadosAutoconocimiento(respuestaId);
    stopLoader();
    if (!data.tieneResultados) {
      document.querySelector(".app-main").innerHTML = `
        <div class="empty-state">
          <div class="empty-state__title">Aún no has tomado la autoevaluación</div>
          <p class="empty-state__desc">Toma la Autoevaluación VIA para ver tus fortalezas firma.</p>
          <a href="/app/cursos" class="btn btn-accent" style="margin-top:var(--s-4);">Ir a mis cursos</a>
        </div>
      `;
      return;
    }
    renderResultados(persona, data, cursoSlug);
  } catch (e) {
    stopLoader();
    console.error("get-resultados-autoconocimiento failed:", e);
    document.querySelector(".app-main").innerHTML = `
      <div class="empty-state">
        <div class="empty-state__title">No pudimos cargar tus resultados</div>
        <p class="empty-state__desc">${escapeHtml(e.message || "Intenta recargar.")}</p>
      </div>
    `;
  }
})();

function renderResultados(persona, data, cursoSlug) {
  // data shape from get-resultados-autoconocimiento:
  //   {
  //     ranking: [{ id, fortaleza, virtud, score }, ...] (24 sorted desc),
  //     virtudes: { sabiduria: { promedio, banda, analisis }, ... },
  //     signatureStrengths: [primer 5 del ranking],
  //     completedAt
  //   }
  const { ranking, virtudes, signatureStrengths, completedAt } = data;

  const backHref = cursoSlug ? `/app/curso?slug=${encodeURIComponent(cursoSlug)}` : "/app/cursos";
  const backLabel = cursoSlug ? "Volver a Mi Curso" : "Volver a mis cursos";
  const fecha = completedAt
    ? new Date(completedAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
    : "";

  document.querySelector(".app-main").innerHTML = `
    <header class="page-header page-header--with-action">
      <div class="page-header__main">
        <span class="page-eyebrow">Tu autoevaluación VIA · ${escapeHtml(fecha)}</span>
        <h2 class="page-title">Tus fortalezas de carácter</h2>
        <p class="page-subtitle">
          No hay fortalezas "buenas" ni "malas". Toda persona tiene las 24; lo
          que cambia es cuáles aparecen primero y con qué intensidad. Las
          <em>fortalezas firma</em> son las que sientes más tuyas — las que usas
          con energía y sin esfuerzo.
        </p>
      </div>
      <a class="btn btn-secondary page-header__action" href="${backHref}">
        ${icon("arrowLeft")}<span>${backLabel}</span>
      </a>
    </header>

    <section class="via-signature">
      <header class="via-signature__header">
        <span class="via-signature__eyebrow">Tus 5 fortalezas firma</span>
        <h3 class="via-signature__title">Las que te definen hoy</h3>
      </header>
      <div class="via-signature__grid">
        ${signatureStrengths.map((f, i) => renderSignatureCard(f, i)).join("")}
      </div>
    </section>

    <section class="via-virtudes">
      <header class="via-virtudes__header">
        <span class="via-virtudes__eyebrow">Las 6 virtudes</span>
        <h3 class="via-virtudes__title">Tu balance por dimensión</h3>
      </header>
      <div class="via-virtudes__grid">
        ${Object.entries(virtudes).map(([key, v]) => renderVirtudCard(key, v)).join("")}
      </div>
    </section>

    <section class="via-ranking">
      <header class="via-ranking__header">
        <span class="via-ranking__eyebrow">El ranking completo</span>
        <h3 class="via-ranking__title">Las 24 fortalezas, de mayor a menor</h3>
        <p class="via-ranking__sub">Lee la lista despacio. Las primeras son recursos para acudir cuando algo se complica. Las últimas no son "defectos" — son áreas para cultivar con cariño.</p>
      </header>
      <ol class="via-ranking__list">
        ${ranking.map((f, i) => renderRankingRow(f, i)).join("")}
      </ol>
    </section>

    <section class="via-reflexion">
      <div class="via-reflexion__inner">
        <span class="via-reflexion__eyebrow">Pregúntate</span>
        <p class="via-reflexion__text">Si una de tus fortalezas firma fuera un superpoder, ¿cómo la usarías para hacer del mundo (o de tu día) un lugar más alegre?</p>
        <p class="via-reflexion__hint">Toma nota en tu libreta de journaling. La trabajaremos en la sesión en vivo.</p>
      </div>
    </section>

    <footer class="resultados-footer">
      <a class="btn btn-secondary" href="${backHref}">${icon("arrowLeft")}<span>${backLabel}</span></a>
    </footer>
  `;

  // Animación stagger de las barras del ranking
  setTimeout(() => {
    document.querySelectorAll(".via-rank-row").forEach((row, i) => {
      setTimeout(() => row.classList.add("is-shown"), i * 50);
    });
  }, 200);
}

function renderSignatureCard(f, idx) {
  const color = VIRTUD_COLORS[f.virtud] || "#888";
  const virtudLabel = VIRTUD_LABELS[f.virtud] || f.virtud;
  return `
    <article class="via-sig-card" style="--virtud-color: ${color};">
      <div class="via-sig-card__rank">#${idx + 1}</div>
      <div class="via-sig-card__body">
        <div class="via-sig-card__virtud">${escapeHtml(virtudLabel)}</div>
        <div class="via-sig-card__fortaleza">${escapeHtml(f.fortaleza)}</div>
        <div class="via-sig-card__score">${f.score}/5</div>
      </div>
    </article>
  `;
}

function renderVirtudCard(key, v) {
  const color = VIRTUD_COLORS[key] || "#888";
  const label = VIRTUD_LABELS[key] || key;
  const pctWidth = Math.round(((v.promedio - 1) / 4) * 100); // 1-5 → 0-100%
  return `
    <article class="via-virtud-card" style="--virtud-color: ${color};">
      <header class="via-virtud-card__head">
        <h4 class="via-virtud-card__name">${escapeHtml(label)}</h4>
        <span class="via-virtud-card__badge">${escapeHtml(v.banda)}</span>
      </header>
      <div class="via-virtud-card__bar">
        <div class="via-virtud-card__fill" style="width: ${pctWidth}%;"></div>
      </div>
      <div class="via-virtud-card__score">Promedio: ${v.promedio.toFixed(1)} / 5</div>
      <p class="via-virtud-card__analisis">${escapeHtml(v.analisis)}</p>
    </article>
  `;
}

function renderRankingRow(f, idx) {
  const color = VIRTUD_COLORS[f.virtud] || "#888";
  const virtudLabel = VIRTUD_LABELS[f.virtud] || f.virtud;
  const widthPct = Math.round((f.score / 5) * 100);
  // Top 5 → resalta como signature
  const isSignature = idx < 5;
  return `
    <li class="via-rank-row ${isSignature ? "is-signature" : ""}" style="--virtud-color: ${color};">
      <span class="via-rank-row__num">${idx + 1}</span>
      <div class="via-rank-row__body">
        <div class="via-rank-row__top">
          <span class="via-rank-row__fortaleza">${escapeHtml(f.fortaleza)}</span>
          <span class="via-rank-row__virtud">${escapeHtml(virtudLabel)}</span>
        </div>
        <div class="via-rank-row__bar">
          <div class="via-rank-row__fill" style="width: ${widthPct}%;"></div>
        </div>
      </div>
      <span class="via-rank-row__score">${f.score}/5</span>
    </li>
  `;
}
