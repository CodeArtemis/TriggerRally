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

Code copyright (c) 2012 [jareiko](https://github.com/jareiko) unless otherwise attributed
and released under the [GPL v3](http://www.gnu.org/licenses/gpl-3.0.html)

Non-code assets have mixed ownership and licensing.
