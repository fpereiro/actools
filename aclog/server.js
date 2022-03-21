/*
ac;log - v0.1.0

Written by Altocode (https://altocode.nl) and released into the public domain.

Please refer to readme.md to read the annotated source (but not yet!).
*/

// *** SETUP ***

var CONFIG = require ('./config.js');
var SECRET = require ('./secret.js');
var ENV    = process.argv [2];

var crypto = require ('crypto');
var fs     = require ('fs');
var Path   = require ('path');
var spawn  = require ('child_process').spawn;
var stream = require ('stream');
var os     = require ('os');
var rline  = require ('readline');
Error.stackTraceLimit = Infinity;

var dale   = require ('dale');
var teishi = require ('teishi');
var lith   = require ('lith');
var cicek  = require ('cicek');
var hitit  = require ('hitit');
var redis  = require ('redis').createClient ({db: CONFIG.redisdb});
var giz    = require ('giz');
var a      = require ('./lib/astack.js');
var redmin = require ('redmin');
redmin.redis = redis;

var mailer = require ('nodemailer').createTransport (require ('nodemailer-ses-transport') (SECRET.ses));

var type = teishi.type, clog = console.log, eq = teishi.eq, inc = function (a, v) {return a.indexOf (v) > -1}, reply = function () {
   cicek.reply.apply (null, dale.fil (arguments, undefined, function (v, k) {
      // We ignore the astack stack if it's there. Note that this means that reply will also interrupt the asynchronous sequences. This is on purpose, since replying is usually the last thing to be done.
      if (! (k === 0 && v && v.path && v.last && v.vars)) return v;
   }));
}, stop = function (rs, rules) {
   return teishi.stop (rules, function (error) {
      reply (rs, 400, {error: error});
   }, true);
}, astop = function (rs, path) {
   a.stop (path, function (s, error) {
      reply (rs, 500, {error: error});
   });
}, mexec = function (s, multi) {
   multi.exec (function (error, data) {
      if (error) return s.next (null, error);
      s.next (data);
   });
}, cbreply = function (rs, cb) {
   return function (error, result) {
      if (error)       return reply (rs, 500, {error: error});
      if (cb === true) return reply (rs, 200);
      if (cb) cb (result);
   };
}

// *** GIZ ***

giz.redis          = redis;
giz.config.expires = 24 * 60 * 60;

// *** REDIS EXTENSIONS ***

redis.keyscan = function (s, match, cursor, keys) {
   if (! cursor) cursor = 0;
   if (! keys)   keys   = {};
   redis.scan (cursor, 'MATCH', match, function (error, result) {
      if (error) return s.next (null, error);
      cursor = result [0];
      dale.go (result [1], function (key) {
         keys [key] = true;
      });
      if (cursor !== '0') return redis.keyscan (s, match, cursor, keys);
      s.next (dale.keys (keys));
   });
}

var Redis = function (s, action) {
   redis [action].apply (redis, [].slice.call (arguments, 2).concat (function (error, data) {
      if (error) s.next (null, error);
      else       s.next (data);
   }));
}

// *** NOTIFICATIONS ***

var aclog = {
   initialize: function (logProcessingFunction) {
      aclog.send = function (log, CB) {
         CB = CB || clog;
         var freshCookie;
         var login = function (cb) {
            freshCookie = true;
            hitit.one ({}, {
               host:   SECRET.aclog.host,
               https:  SECRET.aclog.https,
               method: 'post',
               path:   SECRET.aclog.basepath + '/auth/login',
               body: {username: SECRET.aclog.username, password: SECRET.aclog.password, timezone: new Date ().getTimezoneOffset ()}
            }, function (error, data) {
               if (error) return CB (error);
               aclog.cookie = data.headers ['set-cookie'] [0];
               aclog.csrf   = data.body.csrf;
               cb ();
            });
         }
         var send = function () {
            if (type (log) !== 'object') return CB ({error: 'Log must be an object but instead is of type ' + type (log), log: log});
            hitit.one ({}, {
               host:   SECRET.aclog.host,
               https:  SECRET.aclog.https,
               method: 'post',
               path:   SECRET.aclog.basepath + '/data',
               headers: {cookie: aclog.cookie},
               body:    {csrf: aclog.csrf, log: logProcessingFunction ? logProcessingFunction (log) : log}
            }, function (error) {
               if (error && error.code === 403 && ! freshCookie) return login (send);
               if (error) return CB (error);
               CB ();
            });
         }
         if (! aclog.cookie) login (send);
         else                send ();
      }
   }
}

aclog.initialize (function (log) {
   log = dale.obj (log, function (v, k) {
      var sv = type (v) === 'string' ? v : JSON.stringify (v);
      var length = (sv || '').length;
      if (length > 5000) v = sv.slice (0, 2500) + ' [' + (length - 5000) + ' CHARACTERS OMITTED' + '] ' + sv.slice (-2500);
      return [k, v];
   });
   log.application = 'ac;log';
   log.environment = ENV;
   return log;
});

var notify = function (s, message) {
   if (! ENV || ! SECRET.aclog.username) {
      clog (new Date ().toUTCString (), message);
      return s.next ();
   }
   aclog.send (message, function (error) {
      if (error) return s.next (null, error);
      else s.next ();
   });
}

// *** SENDMAIL ***

var lastEmailSent = 0;

var sendmail = function (s, o) {
   if ((Date.now () - lastEmailSent) < 500) return notify (a.creat (), {priority: 'critical', type: 'mailer error', error: 'Rate limited sendmail after ' + (Date.now () - lastEmailSent) + 'ms', options: o});
   lastEmailSent = Date.now ();
   o.from1 = o.from1 || CONFIG.email.name;
   o.from2 = o.from2 || CONFIG.email.address;
   mailer.sendMail ({
      from:    o.from1 + ' <' + o.from2 + '>',
      to:      o.to1   + ' <' + o.to2   + '>',
      replyTo: o.from2,
      subject: o.subject,
      html:    lith.g (o.message),
   }, function (error, rs) {
      if (! error) return s.next ();
      a.stop (s, [notify, {priority: 'critical', type: 'mailer error', error: error, options: o}]);
   });
}

// *** KABOOT ***

var k = function (s) {

   var command = [].slice.call (arguments, 1);

   var output = {stdout: '', stderr: '', command: command};

   var options = {};
   var commands = dale.fil (command.slice (1), undefined, function (command) {
      if (type (command) !== 'object' || ! command.env) return command;
      options.env = command.env;
   });

   var proc = require ('child_process').spawn (command [0], commands, options);

   var wait = 3;

   var done = function () {
      if (--wait > 0) return;
      if (output.code === 0) s.next (output);
      else                   s.next (0, output);
   }

   dale.go (['stdout', 'stderr'], function (v) {
      proc [v].on ('data', function (chunk) {
         output [v] += chunk;
      });
      proc [v].on ('end', done);
   });

   proc.on ('error', function (error) {
      output.err += error + ' ' + error.stack;
      done ();
   });
   proc.on ('exit',  function (code, signal) {
      output.code = code;
      output.signal = signal;
      done ();
   });
}

// *** HELPERS ***

var H = {};

// Adapted from https://www.regular-expressions.info/email.html
H.email = /^(?=[A-Z0-9][A-Z0-9@._%+-]{5,253}$)[A-Z0-9._%+-]{1,64}@(?:(?=[A-Z0-9-]{1,63}\.)[A-Z0-9]+(?:-[A-Z0-9]+)*\.){1,8}[A-Z]{2,63}$/i

H.trim = function (string) {
   return string.replace (/^\s+|\s+$/g, '').replace (/\s+/g, ' ');
}

// *** ROUTES ***

var routes = [

   // *** UPTIME ROBOT ***

   ['head', '*', function (rq, rs) {
      redis.info (function (error) {
         if (error) reply (rs, 500);
         reply (rs, inc (['/'], rq.url) ? 200 : 404);
      });
   }],

   // *** STATIC ASSETS ***

   ['get', ['lib/*', 'client.js'], cicek.file],
   ['get', 'assets/gotoB.min.js', cicek.file, 'node_modules/gotob/gotoB.min.js'],

   ['get', '/', reply, lith.g ([
      ['!DOCTYPE HTML'],
      ['html', [
         ['head', [
            ['meta', {name: 'viewport', content: 'width=device-width,initial-scale=1'}],
            ['meta', {charset: 'utf-8'}],
            ['title', 'ac;log'],
            dale.go (['ionicons.min', 'pure-min'], function (v) {
               return ['link', {rel: 'stylesheet', href: 'lib/' + v + '.css'}];
            })
         ]],
         ['body', [
            dale.go (['gotoB.min'], function (v) {
               return ['script', {src: 'assets/' + v + '.js'}];
            }),
            ['script', {src: 'client.js'}]
         ]]
      ]]
   ])],

   // *** LOGIN & SIGNUP ***

   ['post', 'auth/login', function (rq, rs) {

      var b = rq.body;

      if (stop (rs, [
         ['body', b, 'object'],
         ['keys of body', dale.keys (b), ['username', 'password', 'timezone'], 'eachOf', teishi.test.equal],
         function () {return [
            dale.go (['username', 'password'], function (key) {
               return ['body.' + key, b [key], 'string']
            }),
            ['body.timezone', b.timezone, 'integer'],
            // UTC-12 to UTC+14
            ['body.timezone', b.timezone, {min: -840, max: 720}, teishi.test.range]
         ]},
      ])) return;

      b.username = H.trim (b.username.toLowerCase ());

      astop (rs, [
         [a.set, 'username', function (s) {
            if (! b.username.match ('@')) return s.next (b.username);
            a.cond (s, [Redis, 'hget', 'emails', b.username], {
               null: [reply, rs, 403, {error: 'auth'}],
            });
         }],
         [a.stop, [a.set, 'session', function (s) {
            a.make (giz.login) (s, s.username, b.password);
         }], function (s, error) {
            if (type (error) === 'string') reply (rs, 403, {error: 'auth'});
            else                           reply (rs, 500, {error: error});
         }],
         [a.set, 'csrf', [a.make (require ('bcryptjs').genSalt), 20]],
         function (s) {
            Redis (s, 'setex', 'csrf:' + s.session, giz.config.expires, s.csrf);
         },
         function (s) {
            reply (rs, 200, {csrf: s.csrf}, {'set-cookie': cicek.cookie.write (CONFIG.cookieName, s.session, {httponly: true, samesite: 'Lax', path: '/', expires: new Date (Date.now () + 1000 * 60 * 60 * 24 * 365 * 10)})});
         },
      ]);
   }],

   ['post', 'auth/signup', function (rq, rs) {

      var b = rq.body;

      if (stop (rs, [
         ['body', b, 'object'],
         ['keys of body', dale.keys (b), ['username', 'password', 'email'], 'eachOf', teishi.test.equal],
         function () {return [
            dale.go (['username', 'password', 'email'], function (key) {
               return ['body.' + key, b [key], 'string']
            }),
         ]},
         function () {return [
            ['body.username', b.username, /^[^@:]+$/, teishi.test.match],
            ['body.password length', b.password.length, {min: 6}, teishi.test.range],
            ['body.email',    b.email,    H.email, teishi.test.match],
         ]},
      ])) return;

      b.username = H.trim (b.username.toLowerCase ());
      if (b.username.length < 3) return reply (rs, 400, {error: 'Trimmed username is less than three characters long.'});
      b.email = H.trim (b.email.toLowerCase ());

      var multi = redis.multi ();
      multi.hget   ('emails',  b.email);
      multi.exists ('users:' + b.username);
      astop (rs, [
         [mexec, multi],
         function (s) {
            if (s.last [0]) return reply (rs, 403, {error: 'email'});
            if (s.last [1]) return reply (rs, 403, {error: 'username'});
            s.next ();
         },
         // TODO: don't do check to users:, verify type of error returned by giz directly to distinguish 403 from 500
         [a.make (giz.signup), b.username, b.password],
         function (s) {
            var multi = redis.multi ();
            multi.hset  ('emails',  b.email, b.username);
            multi.hmset ('users:' + b.username, {
               username:            b.username,
               email:               b.email,
               created:             Date.now ()
            });
            mexec (s, multi);
         },
         ! ENV ? [
            [a.get, reply, rs, 200, {token: '@emailtoken'}],
         ] : [
            [sendmail, {
               to1:     b.username,
               to2:     b.email,
               subject: CONFIG.etemplates.welcome.subject,
               message: CONFIG.etemplates.welcome.message (b.username)
            }],
            [a.set, 'session', [a.make (giz.login), b.username, b.password]],
            [a.set, 'csrf', [a.make (require ('bcryptjs').genSalt), 20]],
            function (s) {
               Redis (s, 'setex', 'csrf:' + s.session, giz.config.expires, s.csrf);
            },
            function (s) {
               reply (rs, 200, {csrf: s.csrf}, {'set-cookie': cicek.cookie.write (CONFIG.cookieName, s.session, {httponly: true, samesite: 'Lax', path: '/', expires: new Date (Date.now () + 1000 * 60 * 60 * 24 * 365 * 10)})});
            },
         ],
      ]);
   }],


   // *** GATEKEEPER FUNCTION ***

   ['all', '*', function (rq, rs) {

      if (! rq.data.cookie)                               return reply (rs, 403, {error: 'nocookie'});
      if (! rq.data.cookie [CONFIG.cookieName]) {
         if (rq.headers.cookie.match (CONFIG.cookieName)) return reply (rs, 403, {error: 'tampered'});
                                                          return reply (rs, 403, {error: 'nocookie'});
      }

      giz.auth (rq.data.cookie [CONFIG.cookieName], function (error, user) {
         if (error)  return reply (rs, 500, {error: error});
         if (! user) return reply (rs, 403, {error: 'session'});

         rs.log.username = user.username;
         rq.user         = user;

         astop (rs, [
            [Redis, 'expire', 'csrf:' + rq.data.cookie [CONFIG.cookieName], giz.config.expires],
            [Redis, 'get',    'csrf:' + rq.data.cookie [CONFIG.cookieName]],
            function (s) {
               rq.user.csrf = s.last;
               rs.next ();
            }
         ]);
      });
   }],

   // *** CSRF PROTECTION ***

   ['get', 'csrf', function (rq, rs) {
      reply (rs, 200, {csrf: rq.user.csrf});
   }],

   ['post', '*', function (rq, rs) {

      if (rq.url.match (/^\/redmin/)) return rs.next ();

      var ctype = rq.headers ['content-type'] || '';
      if (ctype.match (/^multipart\/form-data/i)) {
         if (rq.data.fields.csrf !== rq.user.csrf) return reply (rs, 403, {error: 'csrf'});
         delete rq.data.fields.csrf;
      }
      else {
         if (type (rq.body) !== 'object') return reply (rs, 400, {error: 'body should have as type object but instead is ' + JSON.stringify (rq.body) + ' with type ' + type (rq.body)});
         if (rq.body.csrf !== rq.user.csrf)    return reply (rs, 403, {error: 'csrf'});
         delete rq.body.csrf;
      }
      rs.next ();
   }],

   // *** LOGOUT ***

   ['post', 'auth/logout', function (rq, rs) {
      astop (rs, [
         [a.make (giz.logout), rq.data.cookie [CONFIG.cookieName]],
         [Redis, 'del', 'csrf:' + rq.data.cookie [CONFIG.cookieName]],
         // Firefox throws a console error if it receives an empty body.
         [reply, rs, 200, {}, {'set-cookie': cicek.cookie.write (CONFIG.cookieName, false, {httponly: true, samesite: 'Lax', path: '/'})}],
      ]);
   }],

   // *** DATA ***

   ['post', 'data', function (rq, rs) {
      if (type (rq.body) !== 'object' || type (rq.body.log) !== 'object') return reply (rs, 400);
      var log = rq.body.log;
      log.username = rq.user.username;
      log.t        = new Date ();
      fs.appendFile (CONFIG.logfile, JSON.stringify (rq.body.log) + '\n', cbreply (rs, true));

      // TODO: replace hardcoded notifications
      SECRET.notifications (log, rs, type, sendmail);
   }],

   ['post', 'dataout', function (rq, rs) {
      var b = rq.body;
      if (stop (rs, [
         ['body', b, 'object'],
         ['keys of body', dale.keys (b), ['filter', 'sort'], 'eachOf', teishi.test.equal],
         function () {return [
            ['body.filter', b.filter, 'array', 'oneOf'],
            ['body.sort',   b.sort,   ['object', 'array', 'undefined'], 'oneOf'],
         ]},
      ])) return;
      var filter = function (line) {
         if (b.filter.length === 0) return true;
         if (type (b.filter [0]) === 'string') b.filter = [b.filter];
         return dale.stopNot (b.filter, true, function (step) {
            // TODO add support for nested structures with B.get
            var value = line [step [1]];
            if (step [0] === '=')  return value === step [2];
            if (step [0] === '!=') return value !== step [2];
            if (step [0] === 'range') {
               return dale.stopNot (step [2], true, function (v, k) {
                  if (k === 'min')  return value >= v;
                  if (k === 'max')  return value <= v;
                  if (k === 'less') return value < v;
                  if (k === 'more') return value > v;
               });
            }
            if (step [0] === 'type')  return type (value) === step [2];
            if (step [0] === 'match') return value.match (step [2]);
         });
      }

      var output = [], lines = rline.createInterface ({input: fs.createReadStream (CONFIG.logfile)});

      lines.on ('error', cbreply (rs));
      lines.on ('line', function (line) {
         line = JSON.parse (line);
         if (filter (line)) output.push (line);
      });
      lines.on ('close', function () {
         if (! b.sort) output.sort (function (a, b) {
            return b.t - a.t;
         });
         reply (rs, 200, output);
      });
   }],

   // *** QUERIES ***

   ['get', 'queries', function (rq, rs) {
      var multi = redis.multi ();
      var queries = [{
         name: 'All',
         filter: [],
      }, {
         name: 'All 403s',
         filter: ['=', 'code', 403],
      }, {
         name: 'ac;pic prod 403s',
         filter: [
            ['=', 'code', 403],
            ['=', 'username', 'ac;pic'],
            ['=', 'environment', 'prod'],
         ],
      }, {
         name: 'All non 403s HTTP errors',
         filter: [
            ['!=', 'code', undefined],
            ['!=', 'code', 403],
            ['range', 'code', {min: 400}],
         ],
      }, {
         name: 'All server errors',
         filter: [
            ['!=', 'type', 'response error'],
            ['match', 'type', 'error'],
         ],
      }, {
         name: 'All server errors that are not client errors',
         filter: [
            ['!=', 'type', 'response error'],
            ['!=', 'subtype', 'client error'],
            ['match', 'type', 'error'],
         ],
      }, {
         name: 'All browser errors',
         filter: ['=', 'type', 'client error'],
      }, {
         name: 'Server start',
         filter: ['=', 'type', 'server start'],
      }];
      multi.del ('query');
      dale.go (queries, function (query) {
         multi.hset ('query', query.name, teishi.str ({filter: query.filter, sort: query.sort}));
      });
      //multi.exec ();

      redis.hgetall ('query', cbreply (rs, function (queries) {
         reply (rs, 200, dale.obj (queries, function (query, k) {
            return [k, JSON.parse (query)];
         }));
      }));
   }],

   ['post', 'query/rename', function (rq, rs) {

      var b = rq.body;

      if (stop (rs, [
         ['body', b, 'object'],
         ['keys of body', dale.keys (b), ['oname', 'name'], 'eachOf', teishi.test.equal],
         function () {return [
            ['body.oname', b.oname, 'string'],
            ['body.name',  b.name,  'string'],
         ]},
      ])) return;

      astop (rs, [
         [a.cond, [Redis, 'hexists', 'query', b.name], {
            '1': [reply, rs, 400, {error: 'exists'}],
         }],
         [a.cond, [Redis, 'hexists', 'query', b.oname], {
            '0': [reply, rs, 404],
         }],
         [Redis, 'hget', 'query', b.oname],
         function (s) {
            Redis (s, 'hset', 'query', b.name, s.last);
         },
         [Redis, 'hdel', 'query', b.oname],
         [reply, rs, 200],
      ]);
   }],

   ['post', 'query', function (rq, rs) {

      var b = rq.body;

      if (stop (rs, [
         ['body', b, 'object'],
         ['keys of body', dale.keys (b), ['name', 'filter', 'sort'], 'eachOf', teishi.test.equal],
         function () {return [
            ['body.name',   b.name,     'string'],
            ['body.filter', b.filter, ['object', 'array', 'undefined'], 'oneOf'],
            ['body.sort',   b.sort,   ['object', 'array', 'undefined'], 'oneOf'],
         ]},
      ])) return;

      redis.hset ('query', b.name, JSON.stringify ({filter: b.filter, sort: b.sort}), cbreply (rs, true));
   }],

   ['post', 'query/delete', function (rq, rs) {

      var b = rq.body;

      if (stop (rs, [
         ['body', b, 'object'],
         ['keys of body', dale.keys (b), ['name'], 'eachOf', teishi.test.equal],
      ])) return;

      redis.hdel ('query', b.name, cbreply (rs, true));
   }],

   // *** REDMIN ***

   ['get', 'redmin', reply, redmin.html ()],
   ['post', 'redmin', function (rq, rs) {
      redmin.api (rq.body, cbreply (rs, function (data) {
         reply (rs, 200, data);
      }));
   }],
   ['get', 'redmin/client.js',    cicek.file, 'node_modules/redmin/client.js'],
   ['get', 'redmin/gotoB.min.js', cicek.file, 'node_modules/gotob/gotoB.min.js'],

];

// *** SERVER CONFIGURATION ***

cicek.options.cookieSecret = SECRET.cookieSecret;
cicek.options.log.console  = false;

cicek.apres = function (rs) {
   if (rs.log.url.match (/^\/auth/)) {
      if (rs.log.requestBody && rs.log.requestBody.password) rs.log.requestBody.password = 'OMITTED';
   }

   if (rs.log.code >= 400) {
      var report = ! inc (['favicon.ico', '/csrf'], rs.log.url);
      if (report) notify (a.creat (), {priority: rs.log.code >= 500 ? 'critical' : 'important', type: 'response error', code: rs.log.code, method: rs.log.method, url: rs.log.url, ip: rs.log.origin, userAgent: rs.log.requestHeaders ['user-agent'], headers: rs.log.requestHeaders, body: rs.log.requestBody, data: rs.log.data, user: rs.request.user ? rs.request.user.username : null, rbody: teishi.parse (rs.log.responseBody) || rs.log.responseBody});
   }

   cicek.Apres (rs);
}

cicek.log = function (message) {
   if (type (message) !== 'array' || message [0] !== 'error') return;
   var notification;
   if (message [1] === 'client error') {
      if (message [2] === 'Error: read ECONNRESET') return;
      if (message [2].match ('Error: Parse Error:')) return;
      notification = {
         priority: 'important',
         type:    'client error in server',
         from:    cicek.isMaster ? 'master' : 'worker' + require ('cluster').worker.id,
         error:   message [2]
      }
   }
   else if (message [1] === 'Invalid signature in cookie') {
      return;
      // TODO: re-add notification once cicek ignores attributes in cookies
      /*
      notification = {
         priority: 'important',
         type: 'invalid signature in cookie',
         from:    cicek.isMaster ? 'master' : 'worker' + require ('cluster').worker.id,
         error:   message [2]
      }
      */
   }
   else if (message [1] === 'worker error') notification = {
      priority: 'critical',
      type:    'server error',
      subtype: message [1],
      from:    cicek.isMaster ? 'master' : 'worker' + require ('cluster').worker.id,
      error:   message [2]
   }
   else notification = {
      priority: 'critical',
      type:    'server error',
      subtype: message [1],
      from:    cicek.isMaster ? 'master' : 'worker' + require ('cluster').worker.id,
      error:   message [2]
   }

   notify (a.creat (), notification);
}

cicek.cluster ();

var server = cicek.listen ({port: CONFIG.port}, routes);

process.on ('uncaughtException', function (error, origin) {
   server.close (function () {
      a.seq ([
         [notify, {priority: 'critical', type: 'server error', error: error, stack: error.stack, origin: origin}],
         function () {
            process.exit (1);
         }
      ]);
   });
});

// *** BOOTSTRAP FIRST USER ***

if (cicek.isMaster) redis.exists ('users:' + SECRET.aclog.username, function (error, exists) {
   if (error) return notify (a.creat (), {priority: 'critical', type: 'redis error', error: error});
   if (exists) return setTimeout (function () {notify (a.creat (), {priority: 'important', type: 'server start'})}, 1000);

   setTimeout (function () {
      hitit.one ({}, {host: 'localhost', port: CONFIG.port, method: 'post', path: '/auth/signup', body: {username: SECRET.aclog.username, password: SECRET.aclog.password, email: SECRET.aclog.email}}, function (error, data) {
         if (error) return notify (a.creat (), {priority: 'critical', type: 'Bootstrap first user error', error: error});
         notify (a.creat (), {priority: 'important', type: 'Bootstrap first user OK'});
         notify (a.creat (), {priority: 'important', type: 'server start'});
      });
   // Give the server a second to start itself.
   }, 1000);
});

// *** REDIS ERROR HANDLER ***

var lastRedisErrorNotification = 0;

redis.on ('error', function (error) {
   // Notify maximum once every 60 seconds.
   if ((Date.now () - lastRedisErrorNotification) < (1000 * 60)) return;
   lastRedisErrorNotification = Date.now ();
   notify (a.creat (), {priority: 'critical', type: 'redis error', error: error});
});

// *** LOG BACKUPS ***

if (cicek.isMaster && ENV) setInterval (function () {
   var s3 = new (require ('aws-sdk')).S3 ({
      apiVersion:  '2006-03-01',
      sslEnabled:  true,
      credentials: {accessKeyId: SECRET.s3.accessKeyId, secretAccessKey: SECRET.s3.secretAccessKey},
      params:      {Bucket:      SECRET.s3.bucketName},
   });

   a.stop ([
      // TODO: encrypt backups
      [a.make (s3.upload, s3), {Key: Path.basename (CONFIG.logfile) + new Date ().toUTCString (), Body: fs.createReadStream (CONFIG.logfile)}],
   ], function (s, error) {
      notify (s, {priority: 'critical', type: 'ac;log backup error', error: error});
   });
}, CONFIG.backupFrequency * 60 * 1000);

// *** CHECK OS RESOURCES ***

if (cicek.isMaster && ENV) setInterval (function () {
   a.seq ([
      [a.fork, ['mpstat', 'free'], function (v) {return [k, v]}],
      function (s) {
         if (s.error) return notify (s, {priority: 'critical', type: 'resources check error', error: s.error});
         var cpu  = s.last [0].stdout;
         cpu = cpu.split ('\n') [3].split (/\s+/);
         cpu = Math.round (parseFloat (cpu [cpu.length - 1].replace (',', '.')));

         var free = s.last [1].stdout.split ('\n') [1].split (/\s+/);
         free = Math.round (100 * parseInt (free [6]) / parseInt (free [1]));

         a.seq (s, [
            cpu  < 20 ? [notify, {priority: 'critical', type: 'high CPU usage', usage: (100 - cpu)  / 100}] : [],
            free < 20 ? [notify, {priority: 'critical', type: 'high RAM usage', usage: (100 - free) / 100}] : [],
         ]);
      },
   ]);
}, 1000 * 60);
