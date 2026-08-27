# je viens de teste l'app web:
code erreur :" Plugin: vite:oxc
  File: D:/Tia_info_projet/projet 2/TiaInfoBuild/Web/frontend/src/pages/settings/SettingsPage.tsx
      at transformWithOxc (file:///D:/Tia_info_projet/projet%202/TiaInfoBuild/Web/frontend/node_modules/vite/dist/node/chunks/node.js:4097:19)
      at TransformPluginContext.transform (file:///D:/Tia_info_projet/projet%202/TiaInfoBuild/Web/frontend/node_modules/vite/dist/node/chunks/node.js:4168:26)
      at EnvironmentPluginContainer.transform (file:///D:/Tia_info_projet/projet%202/TiaInfoBuild/Web/frontend/node_modules/vite/dist/node/chunks/node.js:30851:51)
      at async loadAndTransform (file:///D:/Tia_info_projet/projet%202/TiaInfoBuild/Web/frontend/node_modules/vite/dist/node/chunks/node.js:20619:26)
      at async viteTransformMiddleware (file:///D:/Tia_info_projet/projet%202/TiaInfoBuild/Web/frontend/node_modules/vite/dist/node/chunks/node.js:25142:20)
12:54:31 [vite] (client) Pre-transform error: Transform failed with 2 errors:

[PARSE_ERROR] Expected corresponding JSX closing tag for 'div'.
     ╭─[ src/pages/settings/SettingsPage.tsx:581:17 ]
     │
 520 │             <div className="modal-content border-0 shadow">
     │              ─┬─
     │               ╰─── Opened here
     │
 581 │               </form>
     │                 ──┬─
     │                   ╰─── Expected `</div>`
─────╯

[PARSE_ERROR] Adjacent JSX elements must be wrapped in an enclosing tag.
12:54:32 [vite] Internal server error: Transform failed with 2 errors:

[PARSE_ERROR] Expected corresponding JSX closing tag for 'div'.
     ╭─[ src/pages/settings/SettingsPage.tsx:581:17 ]
     │
 520 │             <div className="modal-content border-0 shadow">
     │              ─┬─
     │               ╰─── Opened here
     │
 581 │               </form>
     │                 ──┬─
     │                   ╰─── Expected `</div>`
─────╯

[PARSE_ERROR] Adjacent JSX elements must be wrapped in an enclosing tag.
     ╭─[ src/pages/settings/SettingsPage.tsx:584:9 ]
     │
 584 │         </div>
     │         ┬
     │         ╰──
     │
     │ Help: Did you want a JSX fragment `<>...</>`?
─────╯

  Plugin: vite:oxc
  File: D:/Tia_info_projet/projet 2/TiaInfoBuild/Web/frontend/src/pages/settings/SettingsPage.tsx
      at transformWithOxc (file:///D:/Tia_info_projet/projet%202/TiaInfoBuild/Web/frontend/node_modules/vite/dist/node/chunks/node.js:4097:19)
      at TransformPluginContext.transform (file:///D:/Tia_info_projet/projet%202/TiaInfoBuild/Web/frontend/node_modules/vite/dist/node/chunks/node.js:4168:26)
      at EnvironmentPluginContainer.transform (file:///D:/Tia_info_projet/projet%202/TiaInfoBuild/Web/frontend/node_modules/vite/dist/node/chunks/node.js:30851:51)
      at async loadAndTransform (file:///D:/Tia_info_projet/projet%202/TiaInfoBuild/Web/frontend/node_modules/vite/dist/node/chunks/node.js:20619:26)
      at async viteTransformMiddleware (file:///D:/Tia_info_projet/projet%202/TiaInfoBuild/Web/frontend/node_modules/vite/dist/node/chunks/node.js:25142:20)
"