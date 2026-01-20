Trigger Rally Online Edition
============================

http://triggerrally.com

Current status
--------------

The game currently runs fully client-side.  
No MongoDB or server setup is required to run the game.  
Tracks and runs are stored locally (IndexedDB).  
Tracks and runs can be shared via JSON files.  
Online features are not currently available.  
  
Run with a static file server (examples: `npx serve .` or `python -m http.server`)

Code structure
--------------

Trigger Rally uses JavaScript on both the client and server.

All code now lives under [server/](https://github.com/CodeArtemis/TriggerRally/tree/v3/server).  
Client-only code is in [server/public/scripts/](https://github.com/CodeArtemis/TriggerRally/tree/v3/server/public/scripts)  
Shared code is in [server/shared/](https://github.com/CodeArtemis/TriggerRally/tree/v3/server/shared)  


On the server, we use the node.js module system ('require').  
Run `server/build/build.sh` to build production-mode JS bundles.

Copyright & License
-------------------

Copyright (c) 2012-2013 [Code Artemis](https://github.com/CodeArtemis) unless otherwise attributed.

See [LICENSE.md](LICENSE.md).

Legacy server setup
-------------------

Install MongoDB
```sh
cd server
npm i -g babel-cli
npm i
npm start
```
