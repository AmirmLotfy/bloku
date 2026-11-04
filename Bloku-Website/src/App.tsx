import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  Globe2,
  Menu,
  Moon,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  X,
  EyeOff,
  LockKeyhole,
} from "lucide-react";
import product from "../../shared/product.json";
import legacyPrivacy from "./content/legacy-privacy.json";
import { localeInfo, pagePath } from "./routes";
import type { Copy, LocaleCode, PageContext, PageId, Section } from "./types";

const featurePages: PageId[] = [
  "ad-blocking",
  "privacy-feature",
  "distraction-control",
  "focus",
];
const featureCaptures = ["01-protection.jpg", "05-local-settings.jpg", "02-distractions.jpg", "04-schedules.jpg"];

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand ${compact ? "brand-compact" : ""}`}>
      <span className="brand-mark">
        <img
          src="/bloku-logo.png"
          width="40"
          height="40"
          alt=""
        />
      </span>
      <span>
        BLOKU<span className="brand-period">.</span>
      </span>
    </span>
  );
}

function Install({
  label,
  secondary = false,
}: {
  label: string;
  secondary?: boolean;
}) {
  return (
    <a
      className={`button ${secondary ? "button-secondary" : "button-primary"}`}
      href={product.storeUrl}
      target="_blank"
      rel="noopener noreferrer"
    >
      <ChromeIcon />
      {label}
      <ArrowRight size={16} aria-hidden="true" />
    </a>
  );
}
function ChromeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 8h8.7M8.5 14 4.2 6.5M14 15.5 9.6 21.2" />
    </svg>
  );
}

function Header({ locale, page, copy }: PageContext) {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open]);
  function toggleTheme() {
    const next = !dark;
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem("bloku-theme", next ? "dark" : "light");
    } catch {
      /* Theme still works when storage is unavailable. */
    }
    setDark(next);
  }
  const links: { page: PageId; label: string; hash?: string }[] = [
    { page: "home", label: copy.nav.features, hash: "#features" },
    { page: "support", label: copy.nav.support },
    { page: "changelog", label: copy.nav.changelog },
  ];
  return (
    <header className="site-header">
      <div className="header-inner wrap">
        <a
          href={pagePath(locale, "home")}
          className="brand-link"
          aria-label={`BLOKU · ${copy.nav.home}`}
        >
          <Logo />
        </a>
        <nav className="desktop-nav" aria-label={copy.nav.menu}>
          {links.map((link) => (
            <a
              key={link.label}
              href={`${pagePath(locale, link.page)}${link.hash || ""}`}
              aria-current={
                page === link.page && !link.hash ? "page" : undefined
              }
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <details className="language-menu">
            <summary aria-label={copy.nav.language}>
              <Globe2 size={17} aria-hidden="true" />
              <span>{localeInfo(locale).tag.toUpperCase()}</span>
              <ChevronDown size={12} aria-hidden="true" />
            </summary>
            <div
              className="language-options"
              role="group"
              aria-label={copy.nav.language}
            >
              {product.locales.map((item) => (
                <a
                  key={item.code}
                  href={pagePath(item.code as LocaleCode, page)}
                  lang={item.tag}
                  dir={item.dir}
                  hrefLang={item.tag}
                  aria-current={locale === item.code ? "true" : undefined}
                >
                  {item.label}
                  {locale === item.code && (
                    <Check size={14} aria-hidden="true" />
                  )}
                </a>
              ))}
            </div>
          </details>
          <button
            className="icon-button theme-button"
            onClick={toggleTheme}
            aria-label={copy.nav.theme}
            title={copy.nav.theme}
          >
            {dark ? (
              <Sun size={18} aria-hidden="true" />
            ) : (
              <Moon size={18} aria-hidden="true" />
            )}
          </button>
          <div className="header-install">
            <Install label={copy.nav.install} />
          </div>
          <button
            ref={menuButton}
            className="icon-button mobile-toggle"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? copy.nav.close : copy.nav.menu}
            onClick={() => setOpen(!open)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>
      <nav
        id="mobile-nav"
        className="mobile-nav wrap"
        aria-label={copy.nav.menu}
        hidden={!open}
      >
        {links.map((link) => (
          <a
            key={link.label}
            href={`${pagePath(locale, link.page)}${link.hash || ""}`}
            onClick={() => setOpen(false)}
          >
            {link.label}
          </a>
        ))}
        <Install label={copy.nav.install} />
      </nav>
    </header>
  );
}

function Demo({ copy }: { copy: Copy }) {
  const [blocking, setBlocking] = useState(true);
  const [quiet, setQuiet] = useState(true);
  return (
    <div className="demo" id="demo">
      <div className="browser-shell">
        <div className="browser-toolbar">
          <span className="traffic-lights" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="address">
            <LockKeyhole size={12} aria-hidden="true" />
            <bdi>{copy.demo.domain}</bdi>
          </span>
          <span className="toolbar-logo" aria-hidden="true">
            <img src="/bloku-logo.png" width="22" height="22" alt="" />
          </span>
        </div>
        <div
          className={`example-page ${blocking ? "is-protected" : ""} ${quiet ? "is-quiet" : ""}`}
        >
          <div className="example-masthead">
            <span className="example-symbol" aria-hidden="true">
              ✳
            </span>
            <span>{copy.demo.local}</span>
            <div className="masthead-lines" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="example-content">
            <div className="example-article">
              <span className="eyebrow">{copy.demo.label}</span>
              <h2>{copy.demo.pageTitle}</h2>
              <p className="article-deck">{copy.demo.pageIntro}</p>
              <div className="article-art" aria-hidden="true">
                <span />
                <span />
                <span />
                <i />
              </div>
              <p className="article-body">{copy.demo.reading}</p>
              <div className="ad-slot" aria-hidden={blocking}>
                <small>{copy.demo.advertisement}</small>
                <span />
                <span />
              </div>
            </div>
            <aside className="demo-controls" aria-label={copy.demo.privacy}>
              <div className="demo-control-top">
                <Logo compact />
                <span className="local-dot" aria-hidden="true" />
              </div>
              <p className="control-heading">{copy.demo.privacy}</p>
              <DemoSwitch
                checked={blocking}
                onChange={() => setBlocking(!blocking)}
                label={copy.demo.toggle}
                copy={copy}
                icon={<ShieldCheck size={18} />}
              />
              <DemoSwitch
                checked={quiet}
                onChange={() => setQuiet(!quiet)}
                label={copy.demo.toggleDistractions}
                copy={copy}
                icon={<EyeOff size={18} />}
              />
              <div className="demo-status" aria-live="polite">
                <span
                  className={
                    blocking && quiet ? "status-dot" : "status-dot muted"
                  }
                />
                {blocking && quiet ? copy.demo.clean : copy.demo.local}
              </div>
            </aside>
          </div>
          <div className="example-popup" aria-hidden={quiet}>
            <div>
              <strong>{copy.demo.distraction}</strong>
              <p>{copy.demo.noise}</p>
            </div>
            <span className="popup-mark" aria-hidden="true">
              !
            </span>
          </div>
        </div>
      </div>
      <p className="demo-caption">
        <span className="caption-marker" aria-hidden="true" />
        {copy.demo.disclaimer}
      </p>
    </div>
  );
}
function DemoSwitch({
  checked,
  onChange,
  label,
  copy,
  icon,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  copy: Copy;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="demo-switch-row"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
    >
      <span className="switch-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="switch-text">
        {label}
        <small>{checked ? copy.demo.on : copy.demo.off}</small>
      </span>
      <span className={`switch ${checked ? "checked" : ""}`} aria-hidden="true">
        <i />
      </span>
    </button>
  );
}
function FAQ({ items }: { items: Section[] }) {
  return (
    <div className="faq-list">
      {items.map((item) => (
        <details key={item.title}>
          <summary>
            {item.title}
            <span className="faq-plus" aria-hidden="true">
              +
            </span>
          </summary>
          <p>{item.body}</p>
        </details>
      ))}
    </div>
  );
}
function FeatureVisual({ index, copy, locale }: { index: number; copy: Copy; locale: LocaleCode }) {
  return (
    <figure className={`feature-visual feature-visual-${index} product-capture`}>
      <img
        src={`/product/${locale}/${featureCaptures[index]}`}
        alt={`BLOKU 2.0 · ${copy.features[index].eyebrow}`}
        width="1280"
        height="800"
        loading="lazy"
        decoding="async"
      />
    </figure>
  );
}
function FeatureList({ locale, copy }: PageContext) {
  return (
    <section className="features-section wrap" id="features">
      <div className="section-intro">
        <span className="eyebrow">{copy.home.featureEyebrow}</span>
        <h2>{copy.home.featureTitle}</h2>
        <p>{copy.home.featureIntro}</p>
      </div>
      <div className="feature-list">
        {copy.features.map((feature, index) => (
          <article className="feature-row" key={feature.eyebrow}>
            <div className="feature-copy">
              <span className="feature-number">
                0{index + 1} <span>{feature.eyebrow}</span>
              </span>
              <h3>{feature.title}</h3>
              <p>{feature.summary}</p>
              <a
                className="text-link"
                href={pagePath(locale, featurePages[index])}
              >
                {copy.home.learn}
                <ArrowRight size={17} aria-hidden="true" />
              </a>
            </div>
            <FeatureVisual index={index} copy={copy} locale={locale} />
          </article>
        ))}
      </div>
    </section>
  );
}
function CTA({ copy }: { copy: Copy }) {
  return (
    <section className="cta-section wrap">
      <div className="cta-symbol" aria-hidden="true">
        <img src="/bloku-logo.png" width="68" height="68" alt="" />
      </div>
      <h2>{copy.home.ctaTitle}</h2>
      <p>{copy.home.ctaBody}</p>
      <Install label={copy.nav.install} />
      <span className="cta-note">
        {copy.home.free} <span>·</span> {copy.home.noAccount}
      </span>
      <Compatibility copy={copy} />
    </section>
  );
}
function Home(context: PageContext) {
  const { copy, locale } = context;
  return (
    <>
      <section className="hero wrap">
        <div className="hero-copy">
          <a className="release-link" href={pagePath(locale, "changelog")}>
            <span className="release-dot" />
            {copy.home.eyebrow}
            <ArrowRight size={14} aria-hidden="true" />
          </a>
          <h1>
            {copy.home.title.split("\n").map((line, i) => (
              <span key={line}>
                {line}
                {i === 0 && <br />}
              </span>
            ))}
          </h1>
          <p className="hero-intro">{copy.home.intro}</p>
          <div className="hero-actions">
            <Install label={copy.nav.install} />
            <a className="button button-quiet" href="#demo">
              {copy.home.secondary}
              <ArrowDown size={16} aria-hidden="true" />
            </a>
          </div>
          <ul className="trust-line">
            {[copy.home.free, copy.home.local, copy.home.noAccount].map(
              (text) => (
                <li key={text}>
                  <Check size={14} aria-hidden="true" />
                  {text}
                </li>
              ),
            )}
          </ul>
          <Compatibility copy={copy} />
        </div>
        <Demo copy={copy} />
      </section>
      <section className="demo-intro wrap">
        <span className="eyebrow">{copy.home.demoLabel}</span>
        <h2>{copy.home.demoTitle}</h2>
        <p>{copy.home.demoBody}</p>
      </section>
      <FeatureList {...context} />
      <section className="control-section wrap">
        <div>
          <span className="section-icon">
            <SlidersHorizontal size={25} aria-hidden="true" />
          </span>
          <h2>{copy.home.controlTitle}</h2>
          <p>{copy.home.controlBody}</p>
        </div>
        <ul>
          {copy.home.controlItems.map((item) => (
            <li key={item}>
              <Check size={19} aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </section>
      <section className="privacy-section">
        <div className="wrap privacy-inner">
          <span className="privacy-symbol" aria-hidden="true">
            <LockKeyhole size={56} strokeWidth={1} />
          </span>
          <div>
            <h2>{copy.home.privacyTitle}</h2>
            <p>{copy.home.privacyBody}</p>
            <a className="text-link" href={pagePath(locale, "privacy")}>
              {copy.home.privacyLink}
              <ArrowRight size={17} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>
      <section className="faq-section wrap">
        <div>
          <span className="section-icon">
            <CircleHelp size={26} aria-hidden="true" />
          </span>
          <h2>{copy.home.faqTitle}</h2>
        </div>
        <FAQ items={copy.home.faq} />
      </section>
      <CTA copy={copy} />
    </>
  );
}
function PageHero({
  eyebrow,
  title,
  intro,
}: {
  eyebrow?: string;
  title: string;
  intro: string;
}) {
  return (
    <div className="page-hero">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1>{title}</h1>
      <p>{intro}</p>
    </div>
  );
}
function FeaturePage(context: PageContext) {
  const index = featurePages.indexOf(context.page);
  const feature = context.copy.features[index];
  return (
    <>
      <section className="feature-page wrap">
        <PageHero
          eyebrow={feature.eyebrow}
          title={feature.heading}
          intro={feature.intro}
        />
        <div className="feature-detail">
          <FeatureVisual index={index} copy={context.copy} locale={context.locale} />
          <div className="article-sections">
            {feature.sections.map((section) => (
              <section key={section.title}>
                <h2>{section.title}</h2>
                <p>{section.body}</p>
              </section>
            ))}
          </div>
        </div>
        <a
          className="text-link"
          href={`${pagePath(context.locale, "home")}#features`}
        >
          {context.copy.nav.features}
          <ArrowRight size={17} aria-hidden="true" />
        </a>
      </section>
      <CTA copy={context.copy} />
    </>
  );
}
function Compatibility({ copy }: { copy: Copy }) {
  return (
    <p className="compatibility">
      {copy.details.compatibility.replace("{version}", String(product.minimumChromeVersion))}
    </p>
  );
}
function Support({ copy, locale }: PageContext) {
  return (
    <section className="support-page wrap">
      <PageHero
        eyebrow={copy.nav.support}
        title={copy.support.title}
        intro={copy.support.intro}
      />
      <Compatibility copy={copy} />
      <nav className="jump-links" aria-label={copy.nav.support}>
        <a href="#faq">{copy.support.faqTitle}</a>
        <a href="#troubleshooting">{copy.support.troubleshootingTitle}</a>
        <a href="#contact">{copy.support.contactAction}</a>
      </nav>
      <div className="support-layout">
        <div>
          <section id="faq">
            <h2>{copy.support.faqTitle}</h2>
            <FAQ items={copy.support.faq} />
          </section>
          <section id="troubleshooting">
            <h2>{copy.support.troubleshootingTitle}</h2>
            <div className="article-sections">
              {copy.support.troubleshooting.map((item, i) => (
                <section key={item.title}>
                  <span className="step-count">0{i + 1}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </section>
              ))}
            </div>
          </section>
        </div>
        <aside className="support-aside">
          <section id="contact">
            <CircleHelp size={30} strokeWidth={1.5} aria-hidden="true" />
            <h2>{copy.support.contactTitle}</h2>
            <p>{copy.support.contactBody}</p>
            <a
              className="button button-primary"
              href={`mailto:${product.supportEmail}`}
            >
              {copy.support.contactAction}
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          </section>
          <section id="previous-subscriptions">
            <h3>{copy.support.legacyTitle}</h3>
            <p>{copy.support.legacyBody}</p>
            <a className="text-link" href={pagePath(locale, "privacy")}>
              {copy.nav.privacy}
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          </section>
          {product.fundingUrl && (
            <section id="optional-support">
              <h3>{copy.details.fundingTitle}</h3>
              <p>{copy.details.fundingBody}</p>
              <a className="text-link" href={product.fundingUrl} target="_blank" rel="noopener noreferrer">
                {copy.details.fundingTitle}
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </section>
          )}
        </aside>
      </div>
    </section>
  );
}
function Document({ page, copy, locale }: PageContext) {
  const document = page === "privacy" ? copy.privacy : copy.terms;
  const sections = [
    ...document.sections,
    ...(page === "privacy" ? [{ title: legacyPrivacy[locale].legacyTitle, body: legacyPrivacy[locale].legacy }] : []),
    page === "privacy"
      ? { title: copy.details.fundingPrivacyTitle, body: copy.details.fundingPrivacyBody }
      : { title: copy.details.sourceLink, body: copy.details.licenseBody },
  ];
  return (
    <article className="document-page wrap">
      <PageHero title={document.title} intro={document.intro} />
      <p className="updated">{copy.footer.updated}</p>
      {page === "privacy" && <p className="small-note">{legacyPrivacy[locale].scope}</p>}
      <div className="document-sections">
        {sections.map((section, i) => (
          <section key={section.title}>
            <span className="document-number">0{i + 1}</span>
            <div>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
              {i === sections.length - 1 && (
                <a className="text-link" href={page === "privacy" ? product.fundingPrivacyUrl : product.sourceUrl} target="_blank" rel="noopener noreferrer">
                  {page === "privacy" ? copy.details.paypalPolicy : copy.details.sourceLink}
                  <ArrowRight size={16} aria-hidden="true" />
                </a>
              )}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
function SmallPage({ page, copy, locale }: PageContext) {
  if (page === "hey")
    return (
      <section className="small-page wrap">
        <PageHero
          eyebrow={copy.footer.version}
          title={copy.hey.title}
          intro={copy.hey.intro}
        />
        <ol className="steps">
          {copy.hey.steps.map((step, i) => (
            <li key={step.title}>
              <span>0{i + 1}</span>
              <div>
                <h2>{step.title}</h2>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <a className="button button-primary" href={pagePath(locale, "support")}>
          {copy.hey.help}
          <ArrowRight size={17} aria-hidden="true" />
        </a>
      </section>
    );
  if (page === "bye")
    return (
      <section className="small-page wrap">
        <PageHero title={copy.bye.title} intro={copy.bye.intro} />
        <div className="farewell">
          <h2>{copy.bye.helpTitle}</h2>
          <p>{copy.bye.helpBody}</p>
          <a
            className="button button-primary"
            href={`mailto:${product.supportEmail}?subject=${encodeURIComponent(copy.bye.title)}`}
          >
            {copy.bye.contact}
            <ArrowRight size={17} aria-hidden="true" />
          </a>
        </div>
        <p className="small-note">
          {copy.bye.data}{" "}
          <a href={pagePath(locale, "privacy")}>{copy.nav.privacy}</a>
        </p>
        <Install label={copy.bye.reinstall} secondary />
      </section>
    );
  if (page === "changelog")
    return (
      <section className="small-page wrap">
        <PageHero
          eyebrow={copy.nav.changelog}
          title={copy.changelog.title}
          intro={copy.changelog.intro}
        />
        <article className="release-entry">
          <span className="release-version">2.0</span>
          <div>
            <h2>{copy.changelog.versionTitle}</h2>
            <ul>
              {copy.changelog.items.map((item) => (
                <li key={item}>
                  <Check size={17} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="small-note">{copy.changelog.note}</p>
          </div>
        </article>
      </section>
    );
  return (
    <section className="small-page not-found wrap">
      <span className="error-code" aria-hidden="true">
        404
      </span>
      <PageHero title={copy.notFound.title} intro={copy.notFound.intro} />
      <a className="button button-primary" href={pagePath(locale, "home")}>
        {copy.notFound.action}
        <ArrowRight size={17} aria-hidden="true" />
      </a>
    </section>
  );
}
function Footer({ copy, locale }: PageContext) {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-top">
          <div>
            <a
              href={pagePath(locale, "home")}
              className="brand-link"
              aria-label={`BLOKU · ${copy.nav.home}`}
            >
              <Logo />
            </a>
            <p>{copy.footer.tagline}</p>
            <Compatibility copy={copy} />
          </div>
          <nav aria-label={copy.nav.menu}>
            {(["support", "changelog", "privacy", "terms"] as const).map(
              (page) => (
                <a key={page} href={pagePath(locale, page)}>
                  {copy.nav[page]}
                </a>
              ),
            )}
            <a href={product.sourceUrl} target="_blank" rel="noopener noreferrer">{copy.details.sourceLink}</a>
            {product.fundingUrl && (
              <a href={product.fundingUrl} target="_blank" rel="noopener noreferrer">{copy.details.fundingTitle}</a>
            )}
          </nav>
        </div>
        <div className="footer-bottom">
          <p>© 2026 BLOKU. {copy.footer.rights}</p>
          <p>
            {copy.footer.madeBy}{" "}
            <a
              href={product.publisherUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {product.publisher}
            </a>
          </p>
          <span>{copy.footer.allFree}</span>
        </div>
      </div>
    </footer>
  );
}
export default function App(context: PageContext) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        {context.copy.nav.skip}
      </a>
      <Header {...context} />
      <main id="main-content" tabIndex={-1}>
        {context.page === "home" ? (
          <Home {...context} />
        ) : featurePages.includes(context.page) ? (
          <FeaturePage {...context} />
        ) : context.page === "support" ? (
          <Support {...context} />
        ) : ["privacy", "terms"].includes(context.page) ? (
          <Document {...context} />
        ) : (
          <SmallPage {...context} />
        )}
      </main>
      <Footer {...context} />
    </>
  );
}
