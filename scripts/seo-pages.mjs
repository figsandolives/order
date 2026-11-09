// يبني صفحة حقيقية لكل غلاف ولكل منتج داخل الأغلفة (/slug/ بالعربي و /en/slug/ بالإنجليزي) + sitemap.xml،
// عشان محركات البحث تلقى لكل رابط عنوان ووصف وصورة خاصة فيه.
// كل صفحة نسخة من index.html (نفس المنصة ونفس الشكل)، يتغير فيها رأس الصفحة والنص المخفي بس.
// التشغيل: node scripts/seo-pages.mjs [--site https://figsolives.online] [--base /] [--noindex]
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const SITE = arg("site", "https://figsolives.online").replace(/\/$/, "");
const BASE = arg("base", "/");
const NOINDEX = args.includes("--noindex");
const API = arg("api", "https://162-35-27-249.sslip.io/platform-api/catalog");
const ROOT = path.resolve(arg("root", "."));
const MANIFEST = path.join(ROOT, "seo-pages.json");
// أسماء مجلدات موجودة في الموقع أصلاً، ما نكتب فوقها.
const RESERVED = new Set(["en", "qr", "rest", "scripts", "assets", "edara", "local-data", ".github", "404.html", "index.html"]);
const BRAND_AR = "مخبز التين والزيتون";
const BRAND_EN = "Figs & Olives Bakery";

// نفس قواعد الروابط في script.js بالضبط.
function slugify(text) {
  return String(text || "").trim()
    .replace(/[()[\]{}.,،؛:;!?؟"'«»\/\\|#%&+*=<>~`^]/g, " ")
    .replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}
const coverName = (cover, lang) => lang === "ar" ? cover.nameAr : (cover.nameEn || cover.nameAr);
const coverDesc = (cover, lang) => lang === "ar" ? cover.descriptionAr : (cover.descriptionEn || cover.descriptionAr);
const productName = (item, lang) => lang === "ar" ? item.name : (item.nameEn || item.name);
const productDesc = (item, lang) => lang === "ar" ? (item.description || "") : (item.descriptionEn || item.description || "");
// أحرف إنجليزية وأرقام بس، عشان الرابط ما يتحول لرموز % لما ينسخ.
const asciiSlug = text => slugify(text).normalize("NFKD").replace(/[^a-z0-9-]+/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
const coverSlug = cover => asciiSlug(cover.nameEn) || cover.id.toLowerCase();
const productSlug = item => asciiSlug(item.nameEn) || String(item.id).toLowerCase();
const legacyCoverSlug = (cover, lang) => slugify(coverName(cover, lang)) || cover.id;
const legacyProductSlug = (item, lang) => slugify(productName(item, lang)) || String(item.id);
const langSegments = (lang, segments) => lang === "en" ? ["en", ...segments] : segments;
const same = (a, b) => String(a ?? "") === String(b ?? "");
const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const clip = (text, max = 155) => { const flat = String(text || "").replace(/\s+/g, " ").trim(); return flat.length > max ? `${flat.slice(0, max - 1).replace(/\s+\S*$/, "")}…` : flat; };
const enc = segment => encodeURIComponent(segment);
const urlOf = (...segments) => `${SITE}${BASE}${segments.map(enc).join("/")}${segments.length ? "/" : ""}`;
const images = item => (Array.isArray(item.images) ? item.images : [item.image]).filter(Boolean);
const price = (value, lang) => lang === "ar" ? `${Number(value).toFixed(3)} د.ك` : `${Number(value).toFixed(3)} KWD`;

const response = await fetch(API, { headers: { accept: "application/json" } });
if (!response.ok) throw new Error(`catalog ${response.status}`);
const catalog = await response.json();
if (!Array.isArray(catalog.products) || !Array.isArray(catalog.categories) || !Array.isArray(catalog.covers)) throw new Error("catalog shape");

// نفس فلترة المنصة: الأقسام والمنتجات المفعّلة بس، والمطعم إذا كان شغّال.
const restaurantEnabled = catalog.restaurantEnabled !== false;
const categories = catalog.categories.filter(category => category.active !== false && (restaurantEnabled || category.catalogType !== "restaurant"));
const categoryIds = new Set(categories.map(category => String(category.id)));
const products = catalog.products.filter(item => item.active !== false && categoryIds.has(String(item.category || "")));
const headings = Array.isArray(catalog.headings) ? catalog.headings : [];
const headingCategoryIds = heading => [...(heading?.subheadings || []).flatMap(group => group.categoryIds || []), ...(heading?.categoryIds || [])].map(String);
const categoryProducts = id => products.filter(item => same(item.category, id)).sort((a, b) => Number(a.order) - Number(b.order));
function coverProducts(cover) {
  if (cover.filtered) return (cover.products || []).map(entry => products.find(item => same(item.id, entry?.productId))).filter(Boolean);
  return (cover.items || []).flatMap(entry => entry?.type === "heading" ? headingCategoryIds(headings.find(heading => same(heading.id, entry.id))) : [String(entry?.id || "")]).flatMap(categoryProducts);
}
const covers = catalog.covers
  .map(cover => ({ ...cover, id: String(cover.id || ""), nameAr: String(cover.nameAr || ""), nameEn: String(cover.nameEn || cover.nameAr || ""), descriptionAr: String(cover.descriptionAr || ""), descriptionEn: String(cover.descriptionEn || cover.descriptionAr || "") }))
  .filter(cover => cover.id)
  .map(cover => ({ ...cover, list: [...new Map(coverProducts(cover).map(item => [String(item.id), item])).values()] }))
  .filter(cover => cover.list.length);
// المنتج الموجود في أكثر من غلاف: رابطه الأساسي في أول غلاف (نفس المنصة).
const primaryCover = new Map();
covers.forEach(cover => cover.list.forEach(item => { if (!primaryCover.has(String(item.id))) primaryCover.set(String(item.id), cover); }));
// رابط المنتج باسمه بس (/اسم-المنتج/)، إلا لو اسمه نفس اسم غلاف فيبقى تحت غلافه (نفس script.js).
const coverSlugs = new Set(covers.flatMap(cover => [coverSlug(cover), slugify(cover.nameAr), slugify(cover.nameEn), cover.id.toLowerCase()]));
// منتجين مختلفين بنفس الاسم: كل واحد يبقى تحت غلافه.
const sharedBy = slugOf => {
  const owners = new Map();
  covers.forEach(cover => cover.list.forEach(item => { const key = slugOf(item); if (!owners.has(key)) owners.set(key, new Set()); owners.get(key).add(String(item.id)); }));
  return new Set([...owners].filter(([, ids]) => ids.size > 1).map(([key]) => key));
};
const sharedSlugs = sharedBy(productSlug);
const legacyShared = { ar: sharedBy(item => legacyProductSlug(item, "ar")), en: sharedBy(item => legacyProductSlug(item, "en")) };
const productSegments = item => {
  const slug = productSlug(item);
  return coverSlugs.has(slug) || sharedSlugs.has(slug) ? [coverSlug(primaryCover.get(String(item.id))), slug] : [slug];
};
const legacyProductSegments = (item, lang) => {
  const slug = legacyProductSlug(item, lang);
  return coverSlugs.has(slug) || legacyShared[lang].has(slug) ? [legacyCoverSlug(primaryCover.get(String(item.id)), lang), slug] : [slug];
};
const productUrl = (item, lang) => urlOf(...langSegments(lang, productSegments(item)));

const template = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

function coverImage(cover) {
  if (cover.image && /^https?:/.test(cover.image)) return cover.image;
  const first = cover.list.map(item => images(item)[0]).find(Boolean);
  return first || `${SITE}${BASE}og.png`;
}

function page({ lang, title, description, canonical, alternates, image, imageAlt, seoHtml, jsonLd }) {
  const ar = lang === "ar";
  let html = template;
  const set = (pattern, value) => { html = html.replace(pattern, value); };
  set(/<html[^>]*>/, `<html lang="${ar ? "ar" : "en"}" dir="${ar ? "rtl" : "ltr"}" data-page-lang="${lang}" class="catalog-booting">`);
  set(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  set(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(description)}">`);
  if (NOINDEX) set(/<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex">');
  set(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${esc(canonical)}">`);
  // hreflang: العربي والإنجليزي لنفس الصفحة، والعربي هو الافتراضي.
  html = html.replace(/\s*<link rel="alternate" hreflang="[^"]*"[^>]*>/g, "");
  set(/(<link rel="canonical"[^>]*>)/, `$1\n  <link rel="alternate" hreflang="ar-KW" href="${esc(alternates.ar)}">\n  <link rel="alternate" hreflang="en-KW" href="${esc(alternates.en)}">\n  <link rel="alternate" hreflang="x-default" href="${esc(alternates.ar)}">`);
  set(/<meta property="og:locale"[^>]*>/, `<meta property="og:locale" content="${ar ? "ar_KW" : "en_KW"}">`);
  set(/<meta property="og:type"[^>]*>/, `<meta property="og:type" content="${jsonLd["@type"] === "Product" ? "product" : "website"}">`);
  set(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(title)}">`);
  set(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(description)}">`);
  set(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${esc(canonical)}">`);
  set(/<meta property="og:image" [^>]*>/, `<meta property="og:image" content="${esc(image)}">`);
  set(/<meta property="og:image:alt"[^>]*>/, `<meta property="og:image:alt" content="${esc(imageAlt)}">`);
  set(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${esc(title)}">`);
  set(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${esc(description)}">`);
  set(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${esc(image)}">`);
  set(/(<\/head>)/, `  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>\n$1`);
  // النص المخفي في الصفحة يصير عن هالغلاف أو المنتج بدل النص العام.
  set(/<section class="seo-content"[\s\S]*?<\/section>/, `<section class="seo-content" aria-labelledby="seoTitle">\n${seoHtml}\n    </section>`);
  return html;
}

// الروابط القديمة: GitHub Pages ما يسوي تحويل 301، فكل رابط قديم صفحة تحول للرابط الجديد (يفتح بالعربي) وتحتفظ بالمعاينة.
function redirectPage({ lang, target, title, description, image }) {
  return `<!doctype html>
<html lang="${lang}" dir="${lang === "ar" ? "rtl" : "ltr"}">
<head>
  <meta charset="UTF-8">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(target)}">
  <meta http-equiv="refresh" content="0;url=${esc(target)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(target)}">
  <meta property="og:image" content="${esc(image)}">
  <script>location.replace(${JSON.stringify(target).replace(/</g, "\\u003c")} + location.search + location.hash);</script>
</head>
<body><a href="${esc(target)}">${esc(title)}</a></body>
</html>
`;
}

const pages = new Map(); // relative dir -> html
const redirects = new Map(); // old relative dir -> html
const sitemap = [];
const stamp = Number(catalog.updatedAt);
const lastmod = (Number.isFinite(stamp) && stamp > 0 ? new Date(stamp < 1e12 ? stamp * 1000 : stamp) : new Date(catalog.updatedAt || Date.now())).toISOString().slice(0, 10);
const crumb = (items) => ({ "@type": "BreadcrumbList", itemListElement: items.map(([name, item], index) => ({ "@type": "ListItem", position: index + 1, name, item })) });

for (const cover of covers) {
  const slug = coverSlug(cover);
  if (RESERVED.has(slug)) continue;
  const urls = { ar: urlOf(slug), en: urlOf("en", slug) };
  for (const lang of ["ar", "en"]) {
    const ar = lang === "ar";
    const name = coverName(cover, lang);
    const brand = ar ? BRAND_AR : BRAND_EN;
    const names = cover.list.slice(0, 6).map(item => productName(item, lang)).join(ar ? "، " : ", ");
    const description = clip(coverDesc(cover, lang) ? `${coverDesc(cover, lang)} — ${names}` : (ar ? `اطلب ${name} من ${BRAND_AR}: ${names}. توصيل لجميع مناطق الكويت.` : `Order ${name} from ${BRAND_EN}: ${names}. Delivery across Kuwait.`));
    const productLinks = cover.list.map(item => {
      const href = productUrl(item, lang);
      return `        <li><a href="${esc(href)}">${esc(productName(item, lang))}</a> — ${esc(price(item.price, lang))}</li>`;
    }).join("\n");
    const seoHtml = `      <div class="seo-intro">\n        <h1 id="seoTitle">${esc(name)}</h1>\n        <p>${esc(coverDesc(cover, lang) || description)}</p>\n      </div>\n      <ul>\n${productLinks}\n      </ul>`;
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name, description, url: urls[lang], inLanguage: ar ? "ar-KW" : "en-KW",
      isPartOf: { "@type": "WebSite", name: brand, url: `${SITE}${BASE}` },
      breadcrumb: crumb([[brand, `${SITE}${BASE}`], [name, urls[lang]]]),
      mainEntity: { "@type": "ItemList", itemListElement: cover.list.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: productName(item, lang), url: productUrl(item, lang) })) }
    };
    pages.set(langSegments(lang, [slug]).join("/"), page({ lang, title: `${name} | ${brand}`, description, canonical: urls[lang], alternates: urls, image: coverImage(cover), imageAlt: name, seoHtml, jsonLd }));
    redirects.set(legacyCoverSlug(cover, lang), redirectPage({ lang, target: urls.ar, title: `${name} | ${brand}`, description, image: coverImage(cover) }));
    sitemap.push({ loc: urls[lang], alternates: urls, image: coverImage(cover) });
  }

  for (const item of cover.list) {
    // صفحة وحدة لكل منتج، تحت أول غلاف فيه.
    if (primaryCover.get(String(item.id)) !== cover) continue;
    const canonicalUrls = { ar: productUrl(item, "ar"), en: productUrl(item, "en") };
    for (const lang of ["ar", "en"]) {
      const dir = langSegments(lang, productSegments(item)).join("/");
      if (pages.has(dir) || RESERVED.has(productSegments(item).join("/"))) continue; // اسمين بنفس الرابط: المنصة تفتح الأول، فنفس الشي هني.
      const ar = lang === "ar";
      const brand = ar ? BRAND_AR : BRAND_EN;
      const name = productName(item, lang);
      const cname = coverName(cover, lang);
      const text = productDesc(item, lang);
      const description = clip(text ? `${name} — ${text}` : (ar ? `اطلب ${name} من ${BRAND_AR} بسعر ${price(item.price, "ar")}. توصيل لجميع مناطق الكويت.` : `Order ${name} from ${BRAND_EN} for ${price(item.price, "en")}. Delivery across Kuwait.`));
      const photo = images(item)[0] || coverImage(cover);
      const available = (item.availability?.status || "available") === "available";
      const seoHtml = `      <div class="seo-intro">\n        <span class="kicker"><a href="${esc(urls[lang])}">${esc(cname)}</a></span>\n        <h1 id="seoTitle">${esc(name)}</h1>\n        <p>${esc(text || description)}</p>\n        <p>${esc(price(item.price, lang))}</p>\n      </div>`;
      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Product",
        name, description: clip(text || description, 500), image: images(item).slice(0, 4).length ? images(item).slice(0, 4) : [photo], sku: String(item.id), url: canonicalUrls[lang],
        brand: { "@type": "Brand", name: brand },
        category: cname,
        offers: { "@type": "Offer", price: Number(item.price).toFixed(3), priceCurrency: "KWD", availability: available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: canonicalUrls[lang], seller: { "@type": "Organization", name: brand }, areaServed: "KW" }
      };
      pages.set(dir, page({ lang, title: `${name} | ${cname} | ${brand}`, description, canonical: canonicalUrls[lang], alternates: canonicalUrls, image: photo, imageAlt: name, seoHtml, jsonLd }));
      sitemap.push({ loc: canonicalUrls[lang], alternates: canonicalUrls, image: photo, priority: "0.6" });
      redirects.set(legacyProductSegments(item, lang).join("/"), redirectPage({ lang, target: canonicalUrls.ar, title: `${name} | ${cname} | ${brand}`, description, image: photo }));
    }
  }
}

// صفحة لكل قسم داخل الغلاف (/الغلاف/القسم/)، عشان رابط القسم يفتح بمعاينة صحيحة لما ينرسل.
// المنصة تفتح الغلاف وتنزل للقسم. canonical = رابط الغلاف (نفس المحتوى)، وما تدخل خريطة الموقع.
const categorySlug = category => asciiSlug(category.nameEn) || String(category.id).toLowerCase();
for (const cover of covers) {
  const slug = coverSlug(cover);
  if (RESERVED.has(slug)) continue;
  const ids = cover.filtered
    ? cover.list.map(item => String(item.category))
    : (cover.items || []).flatMap(entry => entry?.type === "heading" ? headingCategoryIds(headings.find(heading => same(heading.id, entry.id))) : [String(entry?.id || "")]);
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const category = categories.find(entry => same(entry.id, id));
    const list = category ? cover.list.filter(item => same(item.category, id)) : [];
    if (!list.length) continue;
    const coverUrls = { ar: urlOf(slug), en: urlOf("en", slug) };
    const dir = [slug, categorySlug(category)].join("/");
    if (pages.has(dir)) continue; // منتج بنفس الاسم تحت الغلاف: المنتج يغلب (نفس script.js).
    const name = category.nameAr || category.nameEn;
    const cname = coverName(cover, "ar");
    const names = list.slice(0, 6).map(item => productName(item, "ar")).join("، ");
    const description = clip(`${name} من ${cname} — ${names}`);
    const photo = images(list[0])[0] || coverImage(cover);
    const seoHtml = `      <div class="seo-intro">\n        <span class="kicker"><a href="${esc(coverUrls.ar)}">${esc(cname)}</a></span>\n        <h1 id="seoTitle">${esc(name)}</h1>\n      </div>\n      <ul>\n${list.map(item => `        <li><a href="${esc(productUrl(item, "ar"))}">${esc(productName(item, "ar"))}</a> — ${esc(price(item.price, "ar"))}</li>`).join("\n")}\n      </ul>`;
    const jsonLd = { "@context": "https://schema.org", "@type": "CollectionPage", name, description, url: urlOf(slug, categorySlug(category)), inLanguage: "ar-KW", breadcrumb: crumb([[BRAND_AR, `${SITE}${BASE}`], [cname, coverUrls.ar], [name, urlOf(slug, categorySlug(category))]]) };
    let html = page({ lang: "ar", title: `${name} | ${cname} | ${BRAND_AR}`, description, canonical: coverUrls.ar, alternates: coverUrls, image: photo, imageAlt: name, seoHtml, jsonLd });
    html = html.replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${esc(urlOf(slug, categorySlug(category)))}">`);
    pages.set(dir, html);
  }
}

// روابط قديمة لمنتجات تصحّح اسمها الإنجليزي: تبقى توديه لرابطه الجديد.
const RENAMED_PRODUCT_SLUGS = {
  "barley-oat-sourdough-indian-chapati-bread-2-piecs": "14191",
  "sprouted-ientils-indian-chapatti-bread-2-pcs": "Pmseqm4tc16",
  "sprouted-ientils-indian-chapatti-bread-with-mixture-2-pcs": "P1788621479529",
  "almond-flour-indian-chapati-bread-kito-diet-2-pieces": "Pmser35he6",
  "fermented-gauliflower-probiotic-food": "14565",
  "beef-bone-broth-with-vegtable": "R44515"
};
for (const [slug, id] of Object.entries(RENAMED_PRODUCT_SLUGS)) {
  const item = products.find(product => String(product.id) === id);
  if (!item) continue;
  for (const lang of ["ar", "en"]) {
    const dir = langSegments(lang, [slug]).join("/");
    if (!redirects.has(dir)) redirects.set(dir, redirectPage({ lang, target: productUrl(item, "ar"), title: `${productName(item, lang)} | ${lang === "ar" ? BRAND_AR : BRAND_EN}`, description: clip(productDesc(item, lang) || productName(item, lang)), image: images(item)[0] || "" }));
  }
}

for (const [dir, html] of redirects) if (!pages.has(dir) && !RESERVED.has(dir)) pages.set(dir, html);

// امسح الصفحات القديمة اللي انشالت (من القائمة السابقة بس، ما نلمس غيرها).
const previous = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : [];
for (const dir of previous) {
  if (pages.has(dir)) continue;
  const file = path.join(ROOT, dir, "index.html");
  if (fs.existsSync(file)) fs.rmSync(file);
  for (let current = path.join(ROOT, dir); current !== ROOT && fs.existsSync(current) && !fs.readdirSync(current).length; current = path.dirname(current)) fs.rmdirSync(current);
}
for (const [dir, html] of pages) {
  fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
  const file = path.join(ROOT, dir, "index.html");
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== html) fs.writeFileSync(file, html);
}
fs.writeFileSync(MANIFEST, `${JSON.stringify([...pages.keys()].sort(), null, 1)}\n`);

const home = `${SITE}${BASE}`;
const entry = ({ loc, alternates, image }, priority) => `  <url>\n    <loc>${esc(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <priority>${priority}</priority>\n${alternates ? `    <xhtml:link rel="alternate" hreflang="ar-KW" href="${esc(alternates.ar)}"/>\n    <xhtml:link rel="alternate" hreflang="en-KW" href="${esc(alternates.en)}"/>\n` : ""}${image ? `    <image:image><image:loc>${esc(image)}</image:loc></image:image>\n` : ""}  </url>`;
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${[entry({ loc: home }, "1.0"), ...sitemap.map(item => entry(item, item.priority || "0.8"))].join("\n")}\n</urlset>\n`;
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml);
console.log(`${pages.size} pages, ${sitemap.length + 1} sitemap urls`);
