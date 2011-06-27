HOST = null; // localhost
PORT = 8001;

// when the daemon started
var starttime = (new Date()).getTime();

var mem = process.memoryUsage();
// every 10 seconds poll for the memory.
setInterval(function () {
  mem = process.memoryUsage();
}, 20*1000);


var crypto     = require('crypto'),
    exec       = require("child_process").exec,
    formidable = require ("formidable"),
    fu         = require("./fu"),
    fs         = require("fs"),
    multipart  = require("multipart"),
    os         = require("os"),
    qs         = require("querystring"),
    sys        = require("sys"),
    url        = require("url"),
    util       = require("util");

var x          = new Date();
var today      = x.getDate();

var MESSAGE_BACKLOG = 200,
    SESSION_TIMEOUT = 60 * 1000;

var channel = new function () {
  var messages = [],
      callbacks = [];

  this.appendMessage = function (nick, type, text) {
    var m = { nick: nick
            , type: type // "msg", "join", "part"
            , text: text
            , timestamp: (new Date()).getTime()
            };

    switch (type) {
      case "msg":
        sys.puts("<" + nick + "> " + text);
        break;
      case "join":
        sys.puts(nick + " join");
        break;
      case "part":
        sys.puts(nick + " part");
        break;
    }

    messages.push( m );

    while (callbacks.length > 0) {
      callbacks.shift().callback([m]);
    }

    while (messages.length > MESSAGE_BACKLOG)
      messages.shift();
  };

  this.query = function (since, callback) {
    var matching = [];
    for (var i = 0; i < messages.length; i++) {
      var message = messages[i];
      if (message.timestamp > since)
        matching.push(message)
    }

    if (matching.length != 0) {
      callback(matching);
    } else {
      callbacks.push({ timestamp: new Date(), callback: callback });
    }
  };

  // clear old callbacks
  // they can hang around for at most 30 seconds.
  // also check for a new day to send the marker
  setInterval(function () {
    var now = new Date();
    while (callbacks.length > 0 && now - callbacks[0].timestamp > 30*1000) {
      callbacks.shift().callback([]);
    }
  }, 3000);
};

var sessions = {};

function createSession (nick) {
  if (nick.length > 50) return null;
  if (/[^\w_\-^!]/.exec(nick)) return null;

  for (var i in sessions) {
    var session = sessions[i];
    if (session && session.nick === nick) {
      delete sessions[i];
      channel.appendMessage(nick, "part");
    }
  }

  var session = { 
    nick: nick, 
    id: Math.floor(Math.random()*99999999999).toString(),
    timestamp: new Date(),

    poke: function () {
      session.timestamp = new Date();
    },

    destroy: function () {
      channel.appendMessage(session.nick, "part");
      delete sessions[session.id];
    }
  };

  sessions[session.id] = session;
  return session;
}

function keyGen(key) {
  var mystring = '';
  if (key == 'github') {
    mystring = os.hostname();
  } else if (key == 'deploy') {
    mystring = os.hostname().split("").reverse().join("");
  }
  var uniq_id = crypto.
        createHash('md5').
        update(mystring).
        digest('hex');
  return uniq_id
}
function upload_file(req, res) {
    //console.log('>>> start of upload');
    //console.log(req['headers']);
    var form = new formidable.IncomingForm(),
        files = [],
        fields = [];

    form.uploadDir = "./files/";

    form
      .on('field', function(field, value) {
        //console.log(field, value);
        fields.push([field, value]);
      })
      .on('file', function(field, file) {
        //console.log(field, file);
        files.push([field, file]);
        fs.rename(file['path'], 'files/' + file['name']);
        fu.get("/files/" + file['name'], fu.staticHandler("/files/" + file['name']));
      })
      .on('end', function() {
        //console.log('-> upload done');
        res.writeHead(200, {'content-type' : 'text/xml'});
        res.write('<?xml version="1.0"?><result>1</result>');
        res.end('<?xml version="1.0"?><result>1</result>');
        return;
      });
    form.parse(req);
}

// interval to kill off old sessions
setInterval(function () {
  var now = new Date();
  for (var id in sessions) {
    if (!sessions.hasOwnProperty(id)) continue;
    var session = sessions[id];

    if (now - session.timestamp > SESSION_TIMEOUT) {
      session.destroy();
    }
  }
}, 1000);

fu.listen(Number(process.env.PORT || PORT), HOST);

fu.get("/", fu.staticHandler("index.html"));
fu.get("/test.html", fu.staticHandler("test.html"));
fu.get("/style.css", fu.staticHandler("style.css"));
fu.get("/background.gif", fu.staticHandler("background.gif"));
fu.get("/background.png", fu.staticHandler("background.png"));
fu.get("/client.js", fu.staticHandler("client.js"));
fu.get("/ajaxfileupload.js", fu.staticHandler("ajaxfileupload.js"));
fu.get("/jquery.js", fu.staticHandler("jquery.js"));
fu.get("/jquery.form.js", fu.staticHandler("jquery.form.js"));
fu.get("/jquery-1.2.6.min.js", fu.staticHandler("jquery-1.2.6.min.js"));

fu

fu.get("/who", function (req, res) {
  var nicks = [];
  for (var id in sessions) {
    if (!sessions.hasOwnProperty(id)) continue;
    var session = sessions[id];
    nicks.push(session.nick);
  }
  res.simpleJSON(200, { nicks: nicks
                      , rss: mem.rss
                      });
});

fu.get("/filelist", function (req, res) {
  var myfiles = fs.readdirSync("./files");
  res.simpleJSON(200, { files: myfiles });
});

fu.get("/join", function (req, res) {
  var nick = qs.parse(url.parse(req.url).query).nick;
  var pw   = qs.parse(url.parse(req.url).query).pass;
  if (nick == null || nick.length == 0 || pw != "onlinepayday") {
    res.simpleJSON(400, {error: "Bad nick."});
    return;
  }
  var session = createSession(nick);
  if (session == null) {
    res.simpleJSON(400, {error: "Nick in use"});
    return;
  }

  //sys.puts("connection: " + nick + "@" + res.connection.remoteAddress);

  channel.appendMessage(session.nick, "join");
  res.simpleJSON(200, { id: session.id
                      , nick: session.nick
                      //, rss: mem.rss
                      , starttime: starttime
                      });
});

fu.post("/githubpush/" + keyGen('github'), function (req, res) {
  var body = '';
  req.addListener('data', function(chunk) {
    body += chunk;
  }).addListener('end', function() {
    res.end( 'thank you');
    var payload = JSON.parse(qs.parse(body).payload);
    repo  = payload.repository.name;
    after = payload.after;
    for (var c in payload.commits) {
      who   = payload.commits[c].author.name;
      msg   = payload.commits[c].message;
      console.log(who + ' committed \'' + msg + '\' to ' + repo + ' (' + after + ')');
      channel.appendMessage("github", "github", who + ' committed \"' + msg + '\" to ' + repo + ' (' + after + ')', "notice");
    }
  });
});

fu.post("/deploynotice/" + keyGen('deploy'), function (req, res) {
  var body = '';
  req.addListener('data', function(chunk) {
    body += chunk;
  }).addListener('end', function() {
    res.end( 'thank you');
    var msg = qs.parse(body).deploy;
    console.log(msg);
    channel.appendMessage("deploy", "deploy", msg, "notice");
  });
  // RUBY
  // require 'net/http'
  // uername = `echo $USER`.strip
  // res = Net::HTTP.post_form(URI.parse('http://localhost:8001/deploynotice'), {"deploy" => "${username} deployed to PLT"})
});

fu.get("/part", function (req, res) {
  var id = qs.parse(url.parse(req.url).query).id;
  var session;
  if (id && sessions[id]) {
    session = sessions[id];
    session.destroy();
  }
  res.simpleJSON(200, { rss: mem.rss });
});

fu.get("/recv", function (req, res) {
  if (!qs.parse(url.parse(req.url).query).since) {
    res.simpleJSON(400, { error: "Must supply since parameter" });
    return;
  }
  var id = qs.parse(url.parse(req.url).query).id;
  var session;
  if (id && sessions[id]) {
    session = sessions[id];
    session.poke();
  }

  var since = parseInt(qs.parse(url.parse(req.url).query).since, 10);

  channel.query(since, function (messages) {
    if (session) session.poke();
    res.simpleJSON(200, { messages: messages, rss: mem.rss });
  });
});

fu.get("/send", function (req, res) {
  var id = qs.parse(url.parse(req.url).query).id;
  var text = qs.parse(url.parse(req.url).query).text;

  var session = sessions[id];
  if (!session || !text) {
    res.simpleJSON(400, { error: "No such session id" });
    return;
  }

  session.poke();

  // Add IRC-like commands here
  // 
  channel.appendMessage(session.nick, "msg", text);
  res.simpleJSON(200, { rss: mem.rss });
});

fu.post("/upload", function (req, res) {
  //console.log(req.headers);
  upload_file(req, res);
});

