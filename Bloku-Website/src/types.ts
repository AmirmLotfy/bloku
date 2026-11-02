export type LocaleCode =
  | "en"
  | "ar"
  | "es"
  | "pt_BR"
  | "fr"
  | "de"
  | "ja"
  | "hi";
export type PageId =
  | "home"
  | "ad-blocking"
  | "privacy-feature"
  | "distraction-control"
  | "focus"
  | "support"
  | "privacy"
  | "terms"
  | "hey"
  | "bye"
  | "changelog"
  | "not-found";
export interface Section {
  title: string;
  body: string;
}
export interface Feature {
  title: string;
  summary: string;
  eyebrow: string;
  heading: string;
  intro: string;
  sections: Section[];
}
export interface DocumentCopy {
  title: string;
  intro: string;
  sections: Section[];
}
export interface Copy {
  meta: { homeTitle: string; homeDescription: string };
  nav: {
    features: string;
    support: string;
    changelog: string;
    privacy: string;
    terms: string;
    install: string;
    menu: string;
    language: string;
    theme: string;
    skip: string;
    home: string;
    close: string;
  };
  home: {
    eyebrow: string;
    title: string;
    intro: string;
    secondary: string;
    free: string;
    local: string;
    noAccount: string;
    demoLabel: string;
    demoTitle: string;
    demoBody: string;
    featureEyebrow: string;
    featureTitle: string;
    featureIntro: string;
    learn: string;
    controlTitle: string;
    controlBody: string;
    controlItems: string[];
    privacyTitle: string;
    privacyBody: string;
    privacyLink: string;
    faqTitle: string;
    faq: Section[];
    ctaTitle: string;
    ctaBody: string;
  };
  demo: {
    label: string;
    domain: string;
    pageTitle: string;
    pageIntro: string;
    reading: string;
    advertisement: string;
    distraction: string;
    noise: string;
    clean: string;
    on: string;
    off: string;
    toggle: string;
    toggleDistractions: string;
    privacy: string;
    local: string;
    disclaimer: string;
  };
  features: Feature[];
  support: {
    title: string;
    intro: string;
    faqTitle: string;
    troubleshootingTitle: string;
    contactTitle: string;
    contactBody: string;
    contactAction: string;
    legacyTitle: string;
    legacyBody: string;
    faq: Section[];
    troubleshooting: Section[];
  };
  privacy: DocumentCopy;
  terms: DocumentCopy;
  hey: { title: string; intro: string; steps: Section[]; help: string };
  bye: {
    title: string;
    intro: string;
    helpTitle: string;
    helpBody: string;
    contact: string;
    reinstall: string;
    data: string;
  };
  changelog: {
    title: string;
    intro: string;
    versionTitle: string;
    items: string[];
    note: string;
  };
  notFound: { title: string; intro: string; action: string };
  footer: {
    tagline: string;
    madeBy: string;
    rights: string;
    version: string;
    allFree: string;
    updated: string;
  };
}
export interface PageContext {
  locale: LocaleCode;
  page: PageId;
  copy: Copy;
  path: string;
}
