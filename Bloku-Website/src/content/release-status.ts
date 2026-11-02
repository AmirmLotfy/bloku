import type { LocaleCode } from "../types";

export interface ReleaseStatusCopy {
  title: string;
  body: string;
  storeAction: string;
}

export const releaseStatus: Record<LocaleCode, ReleaseStatusCopy> = {
  en: {
    title: "BLOKU 2.0 is on its way",
    body: "This website presents BLOKU 2.0, with all features free. The Chrome Web Store currently offers version 1.1.3. Version 2.0 will be available after Google approves it.",
    storeAction: "View Chrome Web Store",
  },
  ar: {
    title: "الإصدار 2.0 من BLOKU في الطريق",
    body: "يعرض هذا الموقع الإصدار 2.0 من BLOKU، وجميع ميزاته مجانية. يوفّر سوق Chrome الإلكتروني حاليًا الإصدار 1.1.3. سيتاح الإصدار 2.0 بعد موافقة Google عليه.",
    storeAction: "عرض الإضافة في سوق Chrome الإلكتروني",
  },
  es: {
    title: "BLOKU 2.0 está en camino",
    body: "Este sitio presenta BLOKU 2.0, con todas las funciones gratuitas. Chrome Web Store ofrece actualmente la versión 1.1.3. La versión 2.0 estará disponible cuando Google la apruebe.",
    storeAction: "Ver en Chrome Web Store",
  },
  pt_BR: {
    title: "O BLOKU 2.0 está chegando",
    body: "Este site apresenta o BLOKU 2.0, com todos os recursos gratuitos. A Chrome Web Store oferece atualmente a versão 1.1.3. A versão 2.0 ficará disponível após a aprovação do Google.",
    storeAction: "Ver na Chrome Web Store",
  },
  fr: {
    title: "BLOKU 2.0 arrive bientôt",
    body: "Ce site présente BLOKU 2.0, dont toutes les fonctionnalités sont gratuites. Le Chrome Web Store propose actuellement la version 1.1.3. La version 2.0 sera disponible après son approbation par Google.",
    storeAction: "Voir sur le Chrome Web Store",
  },
  de: {
    title: "BLOKU 2.0 ist auf dem Weg",
    body: "Diese Website stellt BLOKU 2.0 vor. Alle Funktionen sind kostenlos. Im Chrome Web Store ist derzeit Version 1.1.3 verfügbar. Version 2.0 wird nach der Freigabe durch Google verfügbar sein.",
    storeAction: "Im Chrome Web Store ansehen",
  },
  ja: {
    title: "BLOKU 2.0は近日公開予定です",
    body: "このサイトでは、すべての機能を無料で使えるBLOKU 2.0をご紹介しています。Chrome ウェブストアで現在配信されているのはバージョン1.1.3です。バージョン2.0はGoogleの承認後に公開予定です。",
    storeAction: "Chrome ウェブストアを見る",
  },
  hi: {
    title: "BLOKU 2.0 जल्द आ रहा है",
    body: "यह वेबसाइट BLOKU 2.0 की जानकारी देती है, जिसकी सभी सुविधाएँ मुफ़्त हैं। Chrome वेब स्टोर पर अभी संस्करण 1.1.3 उपलब्ध है। संस्करण 2.0 Google की मंज़ूरी के बाद उपलब्ध होगा।",
    storeAction: "Chrome वेब स्टोर पर देखें",
  },
};
