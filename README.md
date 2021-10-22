Trigger Rally Online Edition
============================

http://triggerrally.com

Code structure
--------------

Trigger uses JavaScript on both the client and server.

All code now lives under [server/](https://github.com/CodeArtemis/TriggerRally/tree/v3/server).  
Client-only code is in [server/public/scripts/](https://github.com/CodeArtemis/TriggerRally/tree/v3/server/public/scripts)  
Shared code is in [server/shared/](https://github.com/CodeArtemis/TriggerRally/tree/v3/server/shared)  


On the server, we use the node.js module system ('require').  
Run `server/build/build.sh` to build production-mode JS bundles.

Copyright & License
-------------------

Copyright (c) 2012-2013 [Code Artemis](https://github.com/CodeArtemis) unless otherwise attributed.

See [LICENSE.md](LICENSE.md).

To Run
-------------------

Install MongoDB
```sh
cd server
npm i -g babel-cli
npm i
npm start
```
