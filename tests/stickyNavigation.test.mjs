import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('public and workspace navigation stay in view while dialogs remain above them',async()=>{
 const css=await readFile('src/index.css','utf8');
 const landing=await readFile('src/Landing.tsx','utf8');
 const app=await readFile('src/App.tsx','utf8');
 assert.match(landing,/<div className="public-header-shell"><header className="public-header">/);
 assert.match(css,/\.public-header-shell\{position:sticky;top:0;z-index:30/);
 assert.match(css,/\.topbar\{position:sticky;top:0;z-index:18/);
 assert.match(css,/\.sidebar\{position:fixed;/);
 assert.match(css,/\.mobile-overlay\{display:block;position:fixed;[^}]*z-index:19/);
 assert.match(css,/\.access-backdrop\{position:fixed;[^}]*z-index:100/);
 assert.match(css,/\.job-detail-backdrop\{position:fixed;[^}]*z-index:1000/);
 assert.match(app,/className="menu-button" onClick=\{\(\) => setMobileMenu\(true\)\}/);
});

test('anchor destinations clear the header and mobile navigation can scroll',async()=>{
 const css=await readFile('src/index.css','utf8');
 const landing=await readFile('src/Landing.tsx','utf8');
 assert.match(css,/\.public-site :is\(#top,#scotland-jobs,#browse-jobs,#how-it-works,#features,#sponsor-insights,#journal,#membership,\.journal-article\)\{scroll-margin-top:96px\}/);
 assert.match(css,/@media\(max-width:650px\)\{\.public-site :is\([^)]+\)\{scroll-margin-top:84px\}/);
 assert.match(css,/\.public-mobile-menu nav\{max-height:calc\(100vh - 86px\);max-height:calc\(100dvh - 86px\);overflow-y:auto/);
 assert.match(landing,/aria-label="Mobile navigation"/);
 assert.match(landing,/if \(menu\) menu\.open = false/);
 assert.match(css,/@media print\{\.public-header-shell,\.topbar\{position:static;box-shadow:none\}/);
});
