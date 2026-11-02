import type {StateV2} from '../model';
export interface Reply {ok:boolean;recovery?:string;state?:StateV2;engine?:{ok:boolean;errors:{message:string}[];revision:number};error?:string;tab?:chrome.tabs.Tab;pauseReloadRequired?:boolean;matches?:number;lists?:{id:string;name:string;ruleCount:number;updatedAt?:string;version?:string}[];buildInfo?:{sdk:string;converter:string;revision:string};}
export async function request(action:string,payload?:unknown):Promise<Reply>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 const response=await Promise.race([chrome.runtime.sendMessage({type:'BLOKU_V2',action,payload}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('BLOKU did not respond. Reopen settings to retry.')),15000);})]).finally(()=>clearTimeout(timer)) as Reply;
 if(!response?.ok)throw new Error(response?.error||response?.engine?.errors?.[0]?.message||'The change could not be confirmed.');
 return response;
}
export function element<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string,className?:string):HTMLElementTagNameMap[K]{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
export function button(text:string,action:()=>void|Promise<void>,className=''):HTMLButtonElement{const node=element('button',text,className);node.type='button';node.addEventListener('click',async()=>{node.disabled=true;try{await action();}catch(error){showError(error);}finally{node.disabled=false;}});return node;}
export function showError(error:unknown){const status=document.querySelector<HTMLElement>('[role="status"]');if(status){status.textContent=error instanceof Error?error.message:String(error);status.classList.add('error');}}
export function setTheme(theme:string){document.documentElement.dataset.theme=theme;}
