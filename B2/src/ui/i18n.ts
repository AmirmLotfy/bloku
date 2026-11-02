import en from '../locales/en.json';
export type Messages = typeof en;
export async function loadMessages(locale:string):Promise<Messages> {
  if(locale==='en')return en;
  try {const response=await fetch(chrome.runtime.getURL(`locales/${locale}.json`));if(response.ok)return {...en,...await response.json()};}catch{}
  return en;
}
export function applyLanguage(locale:string){document.documentElement.lang=locale.replace('_','-');document.documentElement.dir=locale==='ar'?'rtl':'ltr';}
