var testCase = require('nodeunit').testCase,
    MailComposer = require("../lib/mailcomposer").MailComposer,
    toPunycode = require("../lib/punycode"),
    MailParser = require("mailparser").MailParser,
    fs = require("fs");

exports["General tests"] = {
    
    "Create a new MailComposer object": function(test){
        var mailcomposer = new MailComposer();
        test.equal(typeof mailcomposer.on, "function");
        test.equal(typeof mailcomposer.emit, "function");
        test.done();
    },
    
    "Normalize key names": function(test){
        var normalizer = MailComposer.prototype._normalizeKey;
        
        test.equal(normalizer("abc"), "Abc");
        test.equal(normalizer("aBC"), "Abc");
        test.equal(normalizer("ABC"), "Abc");
        test.equal(normalizer("a-b-c"), "A-B-C");
        test.equal(normalizer("ab-bc"), "Ab-Bc");
        test.equal(normalizer("ab-bc-cd"), "Ab-Bc-Cd");
        test.equal(normalizer("AB-BC-CD"), "Ab-Bc-Cd");
        test.equal(normalizer("mime-version"), "MIME-Version"); // special case
        
        test.done();
    },
    
    "Add header": function(test){
        var mc = new MailComposer();
        test.equal(typeof mc._headers["Test-Key"], "undefined");
        mc.addHeader("test-key", "first");
        test.equal(mc._headers["Test-Key"], "first");
        mc.addHeader("test-key", "second");
        test.deepEqual(mc._headers["Test-Key"], ["first","second"]);
        mc.addHeader("test-key", "third");
        test.deepEqual(mc._headers["Test-Key"], ["first","second","third"]);
        test.done();
    },
    
    "Get header": function(test){
        var mc = new MailComposer();
        test.equal(mc._getHeader("MIME-Version"), "1.0");
        test.equal(mc._getHeader("test-key"), "");
        mc.addHeader("test-key", "first");
        test.equal(mc._getHeader("test-key"), "first");
        mc.addHeader("test-key", "second");
        test.deepEqual(mc._getHeader("test-key"), ["first", "second"]);
        test.done();
    },
    
    "Uppercase header keys": function(test){
        var mc = new MailComposer();
        
        mc.addHeader("X-TEST", "first");
        test.equal(mc._headers["X-TEST"], "first");
        
        mc.addHeader("TEST", "second");
        test.equal(mc._headers["Test"], "second");
        
        test.done();
    },
    
    "Set object header": function(test){
        var mc = new MailComposer();
        
        var testObj = {
                stringValue: "String with unicode symbols: ÕÄÖÜŽŠ",
                arrayValue: ["hello ÕÄÖÜ", 12345],
                objectValue: {
                    customerId: "12345"
                }
            };
        
        mc.addHeader("x-mytest-string", "first");
        mc.addHeader("x-mytest-json", testObj);
        
        mc.streamMessage();
        
        //mc.on("data", function(c){console.log(c.toString("utf-8"))})
        
        var mp = new MailParser();
        
        mc.pipe(mp);
        
        mp.on("end", function(mail){
            test.equal(mail.headers['x-mytest-string'], "first");
            test.deepEqual(JSON.parse(mail.headers['x-mytest-json']), testObj);
            //console.log(mail)
            test.done();
        });
    },
    
    "Add message option": function(test){
        var mc = new MailComposer();
        test.equal(typeof mc._message.subject, "undefined");
        
        mc.setMessageOption({
            subject: "Test1",
            body: "Test2",
            nonexistent: "Test3"
        });
        
        test.equal(mc._message.subject, "Test1");
        test.equal(mc._message.body, "Test2");
        test.equal(typeof mc._message.nonexistent, "undefined");
        
        mc.setMessageOption({
            subject: "Test4"
        });
        
        test.equal(mc._message.subject, "Test4");
        test.equal(mc._message.body, "Test2");
        
        test.done();
    },
    
    "Detect mime type": function(test){
        var mc = new MailComposer();
        
        test.equal(mc._getMimeType("test.txt"), "text/plain");
        test.equal(mc._getMimeType("test.unknown"), "application/octet-stream");
        
        test.done();
    },
    
    "keepBcc off": function(test){
        var mc = new MailComposer();
        mc.setMessageOption({bcc: "andris@node.ee"});
        mc._buildMessageHeaders();
        test.ok(!mc._getHeader("Bcc"));
        test.done();
    },
    
    "keepBcc on": function(test){
        var mc = new MailComposer({keepBcc: true});
        mc.setMessageOption({bcc: "andris@node.ee"});
        mc._buildMessageHeaders();
        test.equal(mc._getHeader("Bcc"), "andris@node.ee");
        test.done();
    }
};


exports["Text encodings"] = {
    "Punycode": function(test){
        test.equal(toPunycode("andris@age.ee"), "andris@age.ee");
        test.equal(toPunycode("andris@äge.ee"), "andris@xn--ge-uia.ee");
        test.done();
    },
    
    "Mime words": function(test){
        var mc = new MailComposer();
        test.equal(mc._encodeMimeWord("Tere"), "Tere");
        test.equal(mc._encodeMimeWord("Tere","Q"), "Tere");
        test.equal(mc._encodeMimeWord("Tere","B"), "Tere");
        
        // simple
        test.equal(mc._encodeMimeWord("äss"), "=?UTF-8?Q?=C3=A4ss?=");
        test.equal(mc._encodeMimeWord("äss","B"), "=?UTF-8?B?"+(new Buffer("äss","utf-8").toString("base64"))+"?=");
        
        //multiliple
        test.equal(mc._encodeMimeWord("äss tekst on see siin või kuidas?","Q", 20), "=?UTF-8?Q?=C3=A4ss?= =?UTF-8?Q?_tekst_o?= =?UTF-8?Q?n_see_si?= =?UTF-8?Q?in_v?= =?UTF-8?Q?=C3=B5i_?= =?UTF-8?Q?kuidas?= =?UTF-8?Q?=3F?=");
        
        test.done();
    },
    
    "Addresses": function(test){
        var mc = new MailComposer();
        mc.setMessageOption({
            sender: '"Jaanuar Veebruar, Märts" <märts@märts.eu>'
        });

        test.equal(mc._message.from, "\"=?UTF-8?Q?Jaanuar_Veebruar,_M=C3=A4rts?=\" <=?UTF-8?Q?m=C3=A4rts?=@xn--mrts-loa.eu>");
        
        mc.setMessageOption({
            sender: 'aavik <aavik@node.ee>'
        });
        
        test.equal(mc._message.from, '"aavik" <aavik@node.ee>');
        
        mc.setMessageOption({
            sender: '<aavik@node.ee>'
        });
        
        test.equal(mc._message.from, 'aavik@node.ee');
        
        mc.setMessageOption({
            sender: '<aavik@märts.eu>'
        });
        
        test.equal(mc._message.from, 'aavik@xn--mrts-loa.eu');
        
        // multiple
        
        mc.setMessageOption({
            sender: '<aavik@märts.eu>, juulius@node.ee, "Node, Master" <node@node.ee>'
        });
        
        test.equal(mc._message.from, 'aavik@xn--mrts-loa.eu, juulius@node.ee, "Node, Master" <node@node.ee>');
        
        test.done();
    },
    
    "Invalid subject": function(test){
        var mc = new MailComposer();
        mc.setMessageOption({
            subject: "tere\ntere!"
        });
        
        test.equal(mc._message.subject, "tere tere!");
        test.done();
    },
    
    "Long header line": function(test){
        var mc = new MailComposer();
        
        mc._headers = {
            From: "a very log line, \"=?UTF-8?Q?Jaanuar_Veebruar,_M=C3=A4rts?=\" <=?UTF-8?Q?m=C3=A4rts?=@xn--mrts-loa.eu>"
        };
        
        mc.on("data", function(chunk){
            test.ok(chunk.toString().trim().match(/From\:\s[^\r\n]+\r\n\s+[^\r\n]+/));
            test.done();
        });
        mc._composeHeader();
        
    }
    
};

exports["Mail related"] = {
    "Envelope": function(test){
        var mc = new MailComposer();
        mc.setMessageOption({
            sender: '"Jaanuar Veebruar, Märts" <märts@märts.eu>',
            to: '<aavik@märts.eu>, juulius@node.ee',
            cc: '"Node, Master" <node@node.ee>'
        });

        test.deepEqual(mc._envelope, {from:[ 'märts@xn--mrts-loa.eu' ],to:[ 'aavik@xn--mrts-loa.eu', 'juulius@node.ee'], cc:['node@node.ee' ]});
        test.done();
    },
    
    "Add attachment": function(test){
        var mc = new MailComposer();
        mc.addAttachment();
        test.equal(mc._attachments.length, 0);
        
        mc.addAttachment({filePath:"/tmp/var.txt"});
        test.equal(mc._attachments[0].contentType, "text/plain");
        
        mc.addAttachment({contents:"/tmp/var.txt"});
        test.equal(mc._attachments[1].contentType, "application/octet-stream");
        
        test.done();
    },
    
    "Generate envelope": function(test){
        var mc = new MailComposer();
        mc.setMessageOption({
            sender: '"Jaanuar Veebruar, Märts" <märts@märts.eu>, karu@ahven.ee',
            to: '<aavik@märts.eu>, juulius@node.ee',
            cc: '"Node, Master" <node@node.ee>'
        });
        
        test.deepEqual(mc.getEnvelope(), {from: 'märts@xn--mrts-loa.eu',to:[ 'aavik@xn--mrts-loa.eu', 'juulius@node.ee', 'node@node.ee' ], stamp: 'Postage paid, Par Avion'});
        test.done();
    },
    
    "Generate Headers": function(test){
        var mc = new MailComposer();
        mc.setMessageOption({
            sender: '"Jaanuar Veebruar, Märts" <märts@märts.eu>, karu@ahven.ee',
            to: '<aavik@märts.eu>, juulius@node.ee',
            cc: '"Node, Master" <node@node.ee>',
            replyTo: 'julla@pulla.ee',
            subject: "Tere õkva!"
        });

        mc.on("data", function(chunk){
            chunk = (chunk || "").toString("utf-8");
            test.ok(chunk.match(/^(?:(?:[\s]+|[a-zA-Z0-0\-]+\:)[^\r\n]+\r\n)+\r\n$/));
            test.done();
        });

        mc._composeHeader();
    }
};

exports["Mime tree"] = {
    "No contents": function(test){
        test.expect(4);
        
        var mc = new MailComposer();
        mc._composeMessage();
        
        test.ok(!mc._message.tree.boundary);
        test.equal(mc._getHeader("Content-Type").split(";").shift().trim(), "text/plain");
        test.equal(mc._message.tree.childNodes.length, 0);
        
        for(var i=0, len = mc._message.flatTree.length; i<len; i++){
            if(typeof mc._message.flatTree[i] == "object"){
                test.equal(mc._message.flatTree[i].contents, "\r\n");
            }
        }
        
        test.done();
    },
    "Text contents": function(test){
        test.expect(4);
        
        var mc = new MailComposer();
        mc.setMessageOption({
            body: "test"
        });
        mc._composeMessage();
        
        test.ok(!mc._message.tree.boundary);
        test.equal(mc._getHeader("Content-Type").split(";").shift().trim(), "text/plain");
        test.equal(mc._message.tree.childNodes.length, 0);
        
        for(var i=0, len = mc._message.flatTree.length; i<len; i++){
            if(typeof mc._message.flatTree[i] == "object"){
                test.equal(mc._message.flatTree[i].contents, "test");
            }
        }
        
        test.done();
    },
    "HTML contents": function(test){
        test.expect(4);
        
        var mc = new MailComposer();
        mc.setMessageOption({
            html: "<b>test</b>"
        });
        mc._composeMessage();
        
        test.ok(!mc._message.tree.boundary);
        test.equal(mc._getHeader("Content-Type").split(";").shift().trim(), "text/html");
        test.equal(mc._message.tree.childNodes.length, 0);
        
        for(var i=0, len = mc._message.flatTree.length; i<len; i++){
            if(typeof mc._message.flatTree[i] == "object"){
                test.equal(mc._message.flatTree[i].contents, "<b>test</b>");
            }
        }
        
        test.done();
    },
    "HTML and text contents": function(test){
        test.expect(5);
        
        var mc = new MailComposer();
        mc.setMessageOption({
            body: "test",
            html: "test"
        });
        mc._composeMessage();
        
        test.equal(mc._message.tree.childNodes.length, 2);
        test.equal(mc._getHeader("Content-Type").split(";").shift().trim(), "multipart/alternative");
        test.ok(mc._message.tree.boundary);
        
        for(var i=0, len = mc._message.flatTree.length; i<len; i++){
            if(typeof mc._message.flatTree[i] == "object"){
                test.equal(mc._message.flatTree[i].contents, "test");
            }
        }
        
        test.done();
    },
    "Attachment": function(test){
        test.expect(5);
        
        var mc = new MailComposer();
        mc.setMessageOption();
        mc.addAttachment({contents:"\r\n"});
        mc._composeMessage();
        
        test.equal(mc._message.tree.childNodes.length, 2);
        test.equal(mc._getHeader("Content-Type").split(";").shift().trim(), "multipart/mixed");
        test.ok(mc._message.tree.boundary);
        
        for(var i=0, len = mc._message.flatTree.length; i<len; i++){
            if(typeof mc._message.flatTree[i] == "object"){
                test.equal(mc._message.flatTree[i].contents, "\r\n");
            }
        }
        
        test.done();
    },
    "Several attachments": function(test){
        test.expect(6);
        
        var mc = new MailComposer();
        mc.setMessageOption();
        mc.addAttachment({contents:"\r\n"});
        mc.addAttachment({contents:"\r\n"});
        
        mc._composeMessage();
        
        test.equal(mc._message.tree.childNodes.length, 3);
        test.equal(mc._getHeader("Content-Type").split(";").shift().trim(), "multipart/mixed");
        test.ok(mc._message.tree.boundary);
        
        for(var i=0, len = mc._message.flatTree.length; i<len; i++){
            if(typeof mc._message.flatTree[i] == "object"){
                test.equal(mc._message.flatTree[i].contents, "\r\n");
            }
        }
        
        test.done();
    },
    "Attachment and text": function(test){
        test.expect(7);
        
        var mc = new MailComposer();
        mc.setMessageOption();
        mc.addAttachment({contents:"test"});
        mc.setMessageOption({
            body: "test"
        });
        mc._composeMessage();
        
        test.equal(mc._message.tree.childNodes.length, 2);
        test.equal(mc._getHeader("Content-Type").split(";").shift().trim(), "multipart/mixed");
        test.ok(mc._message.tree.boundary);
        
        mc._message.tree.childNodes[0].headers.forEach(function(header){
            if(header[0]=="Content-Type"){
                test.equal(header[1].split(";").shift().trim(), "text/plain");
            }
        });
        
        mc._message.tree.childNodes[1].headers.forEach(function(header){
            if(header[0]=="Content-Type"){
                test.equal(header[1].split(";").shift().trim(), "application/octet-stream");
            }
        });
        
        for(var i=0, len = mc._message.flatTree.length; i<len; i++){
            if(typeof mc._message.flatTree[i] == "object"){
                test.equal(mc._message.flatTree[i].contents, "test");
            }
        }
        
        test.done();
    },
    "Attachment and html": function(test){
        test.expect(7);
        
        var mc = new MailComposer();
        mc.setMessageOption();
        mc.addAttachment({contents:"test"});
        mc.setMessageOption({
            html: "test"
        });
        mc._composeMessage();
        
        test.equal(mc._message.tree.childNodes.length, 2);
        test.equal(mc._getHeader("Content-Type").split(";").shift().trim(), "multipart/mixed");
        test.ok(mc._message.tree.boundary);
        
        mc._message.tree.childNodes[0].headers.forEach(function(header){
            if(header[0]=="Content-Type"){
                test.equal(header[1].split(";").shift().trim(), "text/html");
            }
        });
        
        mc._message.tree.childNodes[1].headers.forEach(function(header){
            if(header[0]=="Content-Type"){
                test.equal(header[1].split(";").shift().trim(), "application/octet-stream");
            }
        });
        
        for(var i=0, len = mc._message.flatTree.length; i<len; i++){
            if(typeof mc._message.flatTree[i] == "object"){
                test.equal(mc._message.flatTree[i].contents, "test");
            }
        }
        
        test.done();
    },
    "Attachment, html and text": function(test){
        test.expect(11);
        
        var mc = new MailComposer();
        mc.addAttachment({contents:"test"});
        mc.setMessageOption({
            body: "test",
            html: "test"
        });
        mc._composeMessage();
        
        test.equal(mc._message.tree.childNodes.length, 2);
        test.equal(mc._getHeader("Content-Type").split(";").shift().trim(), "multipart/mixed");
        test.ok(mc._message.tree.boundary);
        
        mc._message.tree.childNodes[0].headers.forEach(function(header){
            if(header[0]=="Content-Type"){
                test.equal(header[1].split(";").shift().trim(), "multipart/alternative");
            }
        });
        
        test.ok(mc._message.tree.childNodes[0].boundary);
        
        mc._message.tree.childNodes[0].childNodes[0].headers.forEach(function(header){
            if(header[0]=="Content-Type"){
                test.equal(header[1].split(";").shift().trim(), "text/plain");
            }
        });
        
        mc._message.tree.childNodes[0].childNodes[1].headers.forEach(function(header){
            if(header[0]=="Content-Type"){
                test.equal(header[1].split(";").shift().trim(), "text/html");
            }
        });
        
        mc._message.tree.childNodes[1].headers.forEach(function(header){
            if(header[0]=="Content-Type"){
                test.equal(header[1].split(";").shift().trim(), "application/octet-stream");
            }
        });
        
        for(var i=0, len = mc._message.flatTree.length; i<len; i++){
            if(typeof mc._message.flatTree[i] == "object"){
                test.equal(mc._message.flatTree[i].contents, "test");
            }
        }
        
        test.done();
    }
    
};

exports["Stream parser"] = {
    "Text": function(test){
        var mc = new MailComposer(),
            file = fs.readFileSync(__dirname+"/textfile.txt").toString("utf-8");
        mc.setMessageOption({
            from: "andris@node.ee",
            to:"andris@tr.ee, andris@kreata.ee",
            subject: "õäöü",
            body: file
        });
        mc.streamMessage();
        
        var mp = new MailParser();
        
        mc.pipe(mp);
        
        mp.on("end", function(mail){
            test.equal(mail.from[0].address, "andris@node.ee");
            test.equal(mail.to[0].address, "andris@tr.ee");
            test.equal(mail.to[1].address, "andris@kreata.ee");
            test.equal(mail.subject, "õäöü");
            test.equal(mail.text.trim(), file.trim());
            test.done();
        });
    },
    "HTML": function(test){
        var mc = new MailComposer();
        mc.setMessageOption({
            html: "<b>test</b>"
        });
        mc.streamMessage();
        
        var mp = new MailParser();
        
        mc.pipe(mp);
        
        mp.on("end", function(mail){
            test.equal(mail.html.trim(), "<b>test</b>");
            test.done();
        });
    },
    "HTML and text": function(test){
        var mc = new MailComposer();
        mc.setMessageOption({
            html: "<b>test</b>",
            body: "test"
        });
        mc.streamMessage();
        
        var mp = new MailParser();
        
        mc.pipe(mp);
        
        mp.on("end", function(mail){
            test.equal(mail.text.trim(), "test");
            test.equal(mail.html.trim(), "<b>test</b>");
            test.done();
        });
    },
    "Flowed text": function(test){
        var mc = new MailComposer({encoding:"8bit"}),
            file = fs.readFileSync(__dirname+"/textfile.txt").toString("utf-8");
        
        mc.setMessageOption({
            body: file
        });
        mc.streamMessage();
        
        var mp = new MailParser();
        
        mc.pipe(mp);
        
        mp.on("end", function(mail){
            test.equal(mail.text.trim(), file.trim());
            test.done();
        });
    },
    "Attachment as string": function(test){
        var mc = new MailComposer();
        mc.setMessageOption();
        mc.addAttachment({
            fileName: "file.txt",
            contents: fs.readFileSync(__dirname+"/textfile.txt").toString("utf-8")
        });
        mc.streamMessage();
        
        var mp = new MailParser();
        
        mc.pipe(mp);
        
        mp.on("end", function(mail){
            test.equal(mail.attachments[0].checksum, "59fbcbcaf18cb9232f7da6663f374eb9");
            test.done();
        });
    },
    "Attachment as buffer": function(test){
        var mc = new MailComposer();
        mc.setMessageOption();
        mc.addAttachment({
            fileName: "file.txt",
            contents: fs.readFileSync(__dirname+"/textfile.txt")
        });
        mc.streamMessage();
        
        var mp = new MailParser();
        
        mc.pipe(mp);
        
        mp.on("end", function(mail){
            test.equal(mail.attachments[0].checksum, "59fbcbcaf18cb9232f7da6663f374eb9");
            test.done();
        });
    },
    "Attachment file stream": function(test){
        var mc = new MailComposer();
        mc.setMessageOption();
        mc.addAttachment({
            fileName: "file.txt",
            filePath: __dirname+"/textfile.txt"
        });
        mc.streamMessage();
        
        var mp = new MailParser();
        
        mc.pipe(mp);
        
        mp.on("end", function(mail){
            test.equal(mail.attachments[0].checksum, "59fbcbcaf18cb9232f7da6663f374eb9");
            test.done();
        });
    },
    "Attachment source stream": function(test){
        var mc = new MailComposer();
        
        var fileStream = fs.createReadStream(__dirname+"/textfile.txt");
        
        mc.setMessageOption();
        mc.addAttachment({
            fileName: "file.txt",
            streamSource: fileStream
        });
        mc.streamMessage();
        
        var mp = new MailParser();
        
        mc.pipe(mp);
        
        mp.on("end", function(mail){
            test.equal(mail.attachments[0].checksum, "59fbcbcaf18cb9232f7da6663f374eb9");
            test.done();
        });
    },
    "escape SMTP": function(test){
        var mc = new MailComposer({escapeSMTP: true});
        mc.setMessageOption({
            body: ".\r\n."
        });
        mc.streamMessage();
        
        var mp = new MailParser();
        
        mc.pipe(mp);
        
        mp.on("end", function(mail){
            test.equal(mail.text.trim(), "..\n..");
            test.done();
        });
    },
    "don't escape SMTP": function(test){
        var mc = new MailComposer({escapeSMTP: false});
        mc.setMessageOption({
            body: ".\r\n."
        });
        mc.streamMessage();
        
        var mp = new MailParser();
        
        mc.pipe(mp);
        
        mp.on("end", function(mail){
            test.equal(mail.text.trim(), ".\n.");
            test.done();
        });
    },
    "HTML and text and attachment": function(test){
        var mc = new MailComposer();
        mc.setMessageOption({
            html: "<b>test</b>",
            body: "test"
        });
        mc.addAttachment({
            fileName: "file.txt",
            contents: fs.readFileSync(__dirname+"/textfile.txt").toString("utf-8")
        });
        mc.streamMessage();
        
        var mp = new MailParser();
        
        mc.pipe(mp);
        
        mp.on("end", function(mail){
            test.equal(mail.text.trim(), "test");
            test.equal(mail.html.trim(), "<b>test</b>");
            test.equal(mail.attachments[0].checksum, "59fbcbcaf18cb9232f7da6663f374eb9");
            test.done();
        });
    },
    "HTML and related attachment": function(test){
        var mc = new MailComposer();
        mc.setMessageOption({
            html: "<b><img src=\"cid:test@node\"/></b>"
        });
        mc.addAttachment({
            fileName: "file.txt",
            cid: "test@node",
            contents: fs.readFileSync(__dirname+"/textfile.txt").toString("utf-8")
        });
        mc.streamMessage();
        
        var mp = new MailParser();
        
        mc.pipe(mp);
        /*
        var d = "";
        mc.on("data", function(data){
            d += data.toString();
        })
        
        mc.on("end", function(){
            console.log(d);
        });
        */
        
        mp.on("end", function(mail){
            test.equal(mc._attachments.length, 0);
            test.equal(mc._relatedAttachments.length, 1);
            test.equal(mail.html.trim(), "<b><img src=\"cid:test@node\"/></b>");
            test.equal(mail.attachments[0].checksum, "59fbcbcaf18cb9232f7da6663f374eb9");
            test.done();
        });
    },
    "HTML and related plus regular attachment": function(test){
        var mc = new MailComposer();
        mc.setMessageOption({
            html: "<b><img src=\"cid:test@node\"/></b>"
        });
        mc.addAttachment({
            fileName: "file.txt",
            cid: "test@node",
            contents: fs.readFileSync(__dirname+"/textfile.txt").toString("utf-8")
        });
        mc.addAttachment({
            fileName: "file.txt",
            contents: fs.readFileSync(__dirname+"/textfile.txt").toString("utf-8")
        });
        mc.streamMessage();
        
        var mp = new MailParser();
        
        mc.pipe(mp);
        
        mp.on("end", function(mail){
            test.equal(mc._attachments.length, 1);
            test.equal(mc._relatedAttachments.length, 1);
            test.equal(mail.html.trim(), "<b><img src=\"cid:test@node\"/></b>");
            test.equal(mail.attachments[0].checksum, "59fbcbcaf18cb9232f7da6663f374eb9");
            test.equal(mail.attachments[1].checksum, "59fbcbcaf18cb9232f7da6663f374eb9");
            test.done();
        });
    },
    "HTML and text related attachment": function(test){
        var mc = new MailComposer();
        mc.setMessageOption({
            html: "<b><img src=\"cid:test@node\"/></b>",
            text:"test"
        });
        mc.addAttachment({
            fileName: "file.txt",
            cid: "test@node",
            contents: fs.readFileSync(__dirname+"/textfile.txt").toString("utf-8")
        });
        mc.streamMessage();
        
        var mp = new MailParser();
        
        mc.pipe(mp);
        
        mp.on("end", function(mail){
            test.equal(mc._attachments.length, 0);
            test.equal(mc._relatedAttachments.length, 1);
            test.equal(mail.text.trim(), "test");
            test.equal(mail.html.trim(), "<b><img src=\"cid:test@node\"/></b>");
            test.equal(mail.attachments[0].checksum, "59fbcbcaf18cb9232f7da6663f374eb9");
            test.done();
        });
    },
    "HTML, text, related+regular attachment": function(test){
        var mc = new MailComposer();
        mc.setMessageOption({
            html: "<b><img src=\"cid:test@node\"/></b>",
            text:"test"
        });
        mc.addAttachment({
            fileName: "file.txt",
            cid: "test@node",
            contents: fs.readFileSync(__dirname+"/textfile.txt").toString("utf-8")
        });
        mc.addAttachment({
            fileName: "file.txt",
            contents: fs.readFileSync(__dirname+"/textfile.txt").toString("utf-8")
        });
        mc.streamMessage();
        
        var mp = new MailParser();
        
        mc.pipe(mp);
        
        mp.on("end", function(mail){
            test.equal(mc._attachments.length, 1);
            test.equal(mc._relatedAttachments.length, 1);
            test.equal(mail.text.trim(), "test");
            test.equal(mail.html.trim(), "<b><img src=\"cid:test@node\"/></b>");
            test.equal(mail.attachments[0].checksum, "59fbcbcaf18cb9232f7da6663f374eb9");
            test.equal(mail.attachments[1].checksum, "59fbcbcaf18cb9232f7da6663f374eb9");
            test.done();
        });
    }
};



