Trigger Rally Online Edition
============================

http://triggerrally.com

Copyright (c) 2012 [jareiko](https://github.com/jareiko)

Released under the [GPL v3](http://www.gnu.org/licenses/gpl-3.0.html).


Code structure
--------------

TROE uses JavaScript on both the client and server.

Client-only code is in src/  
Shared code is in server/shared/  
Other server code is in server/


On the server, we use the node.js module system ('require').  
On the client, all the code is compiled into a single file with compile-closure.sh.
