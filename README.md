Trigger Rally Online Edition
============================

http://triggerrally.com

Code structure
--------------

TROE uses JavaScript on both the client and server.

Client-only code is in [src/](https://github.com/jareiko/TriggerRallyOE/tree/master/src)  
Shared code is in [server/shared/](https://github.com/jareiko/TriggerRallyOE/tree/master/server/shared)  
Other server code is in [server/](https://github.com/jareiko/TriggerRallyOE/tree/master/server)


On the server, we use the node.js module system ('require').  
On the client, all the code is compiled into a single file with compile-closure.sh.

Copyright & License
-------------------

Code copyright (c) 2012 [jareiko](https://github.com/jareiko)
and released under the [GPL v3](http://www.gnu.org/licenses/gpl-3.0.html)

Directories with mixed ownership and licensing:

    server/THREE/code/
    server/node_modules/
    server/public/
