import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultState} from './model';
import {validateState,exportSettings,importSettings} from './migration';
import {presetSiteFor,presetSiteForUrl,elementSelectors,changeElementHide,restoreSiteHides} from './distraction-scopes';

test('consumer presets exclude business tools, creator studios, embedded players and lookalike domains',()=>{
 for(const host of ['business.facebook.com','adsmanager.facebook.com','studio.youtube.com','music.youtube.com','ads.x.com','player.twitch.tv','canva.com','facebook.com.evil.test'])assert.equal(presetSiteFor(host),undefined,host);
 assert.equal(presetSiteFor('facebook.com'),'facebook.com');assert.equal(presetSiteFor('m.youtube.com'),'youtube.com');assert.equal(presetSiteFor('old.reddit.com'),'reddit.com');
});
test('URL-scoped Facebook presets exclude ad, business and professional tools on consumer hosts',()=>{
 for(const route of ['adsmanager','business','ads','commerce_manager','events_manager','professional_dashboard']){
  for(const suffix of ['', '/', '/accounts/123?view=feed'])assert.equal(presetSiteForUrl(`https://www.facebook.com/${route}${suffix}`),undefined,`${route}${suffix}`);
 }
 assert.equal(presetSiteForUrl('https://m.facebook.com/adsmanager/manage'),undefined);
 assert.equal(presetSiteForUrl('https://web.facebook.com/business/tools'),undefined);
});
test('URL-scoped LinkedIn presets exclude work tools and company admin without excluding company pages',()=>{
 for(const route of ['campaignmanager','talent','sales','learning']){
  for(const suffix of ['', '/', '/accounts/123'])assert.equal(presetSiteForUrl(`https://www.linkedin.com/${route}${suffix}`),undefined,`${route}${suffix}`);
 }
 for(const route of ['/company/123/admin','/company/acme/admin/analytics','/company/acme/admin/'])assert.equal(presetSiteForUrl(`https://www.linkedin.com${route}`),undefined,route);
 for(const route of ['/company/acme','/company/acme/posts','/company/acme/administrator','/company/admin'])assert.equal(presetSiteForUrl(`https://www.linkedin.com${route}`),'linkedin.com',route);
});
test('URL-scoped X and Twitter presets exclude settings and professional tools',()=>{
 for(const host of ['x.com','www.x.com','mobile.x.com','twitter.com','mobile.twitter.com']){
  for(const route of ['/settings','/settings/account','/i/ads','/i/ads/accounts','/i/monetization','/i/professional/tools'])assert.equal(presetSiteForUrl(`https://${host}${route}`),undefined,`${host}${route}`);
 }
});
test('consumer routes remain eligible and tool names in queries or longer path segments do not exclude them',()=>{
 const cases=[
  ['https://www.facebook.com/','facebook.com'],['http://m.facebook.com/?next=/adsmanager','facebook.com'],
  ['https://www.facebook.com/adsmanagerial','facebook.com'],['https://facebook.com/businesses','facebook.com'],['https://facebook.com/ads-archive','facebook.com'],
  ['https://www.linkedin.com/feed/?return=/campaignmanager','linkedin.com'],['https://linkedin.com/salesforce','linkedin.com'],
  ['https://x.com/home?next=/settings/account','x.com'],['https://x.com/author/status/123','x.com'],['https://x.com/settings-help','x.com'],['https://x.com/i/ads-help','x.com'],
  ['https://twitter.com/home','twitter.com'],['https://www.youtube.com/watch?v=owned&next=/business','youtube.com'],['https://m.youtube.com/shorts/owned','youtube.com'],
  ['https://old.reddit.com/','reddit.com'],['https://www.instagram.com/','instagram.com'],['https://www.twitch.tv/owned','twitch.tv'],['https://www.tiktok.com/@owned/video/123','tiktok.com'],
  ['https://facebook.com/?next=%zz#adsmanager','facebook.com'],
 ];
 for(const [url,site]of cases)assert.equal(presetSiteForUrl(url),site,url);
});
test('escaped tool paths are excluded once decoded and malformed paths fail closed',()=>{
 for(const url of [
  'https://www.facebook.com/%61dsmanager/manage','https://www.facebook.com/%2Fbusiness/tools','https://www.facebook.com/ADS/manager',
  'https://www.linkedin.com/company/acme/%61dmin/analytics','https://www.linkedin.com/%63ampaignmanager/accounts',
  'https://x.com/%73ettings/account','https://x.com/i%2Fads/accounts','https://twitter.com/i%5Cprofessional/tools',
  'https://x.com/%zz','https://facebook.com/%E0%A4%A',
 ])assert.equal(presetSiteForUrl(url),undefined,url);
});
test('URL preset selection rejects invalid input, forged schemes, credential URLs and excluded hosts',()=>{
 for(const value of [undefined,null,42,{},'', 'facebook.com/adsmanager','/home','javascript:https://facebook.com/','data:text/html,facebook.com','ftp://facebook.com/',
  'https://facebook.com.evil.test/','https://facebook.com@evil.test/','https://evil.test@facebook.com/','https://user:secret@x.com/home',
  'https://business.facebook.com/','https://adsmanager.facebook.com/','https://studio.youtube.com/','https://music.youtube.com/','https://ads.x.com/','https://player.twitch.tv/',
  'https://canva.com/','https://ads.google.com/','https://www.google.com/',
 ])assert.equal(presetSiteForUrl(value),undefined,String(value));
});
test('an embedded hide applies only to its exact top site and frame, never unrelated embeds or standalone pages',()=>{
 const s=changeElementHide(defaultState(),'design.test','widget.test',false,'#promotion',false);
 assert.deepEqual(elementSelectors(s,'design.test','widget.test',false),['#promotion']);
 for(const [site,frame,top]of[['other.test','widget.test',false],['design.test','other.test',false],['widget.test','widget.test',true]]as const)assert.deepEqual(elementSelectors(s,site,frame,top),[]);
 assert.deepEqual(s.distractionRules,{});assert.equal(s.embeddedHides?.length,1);
});
test('restore a site preserves parent hides, other sites, focus, presets and custom network rules',()=>{
 let s=defaultState();s.distractionRules={'example.test':['#parent'],'app.example.test':['#local'],'other.test':['#other']};s.distractionPresets={'youtube.com':['comments']};s.userRulesText='||tracker.test^';s.focusProfiles=[{id:'work',name:'Work',domains:['social.test'],enabled:true,schedules:[],dailyAllowanceMinutes:10}];
 s=changeElementHide(s,'app.example.test','widget.test',false,'.ad',false);s=changeElementHide(s,'other.test','widget.test',false,'.ad',false);
 const next=restoreSiteHides(s,'app.example.test');assert.deepEqual(next.distractionRules,{'example.test':['#parent'],'other.test':['#other']});assert.deepEqual(next.embeddedHides,[{site:'other.test',frame:'widget.test',selectors:['.ad']}]);assert.deepEqual(next.focusProfiles,s.focusProfiles);assert.deepEqual(next.distractionPresets,s.distractionPresets);assert.equal(next.userRulesText,s.userRulesText);
});
test('frame hides save uniquely, undo exactly, and roundtrip without replaying timed sessions',()=>{
 let s=changeElementHide(defaultState(),'app.test','widget.test',false,'#promo',false);s=changeElementHide(s,'app.test','widget.test',false,'#promo',false);assert.equal(s.embeddedHides?.[0].selectors.length,1);validateState(s);assert.deepEqual(importSettings(exportSettings(s)).embeddedHides,s.embeddedHides);const next=changeElementHide(s,'app.test','widget.test',false,'#promo',true);assert.deepEqual(next.embeddedHides,[]);assert.equal(s.embeddedHides?.length,1);
});
test('embedded hide imports reject URL-shaped domains, duplicate scopes and executable/style text',()=>{
 for(const item of [{site:'https://app.test',frame:'widget.test',selectors:['#ad']},{site:'app.test',frame:'widget.test',selectors:['body{display:none}']},{site:'app.test',frame:'widget.test',selectors:['.x/*']},{site:'app.test',frame:'widget.test',selectors:['']}])assert.throws(()=>validateState({...defaultState(),embeddedHides:[item]}));
 const rule={site:'app.test',frame:'widget.test',selectors:['#ad']};assert.throws(()=>validateState({...defaultState(),embeddedHides:[rule,rule]}));assert.doesNotThrow(()=>validateState(defaultState()));
});

test('standalone embedded YouTube players stay outside consumer presets',()=>{
 assert.equal(presetSiteForUrl('https://www.youtube.com/embed/example?autoplay=1'),undefined);
 assert.equal(presetSiteForUrl('https://www.youtube.com/watch?v=example'),'youtube.com');
 assert.equal(presetSiteForUrl('https://www.youtube.com/embeddings'),'youtube.com');
});
