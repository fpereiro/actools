/*
ac;tools - v0.1.0

Written by Altocode (https://altocode.nl) and released into the public domain.

Please refer to readme.md to read the annotated source (some parts are annotated already, but not the whole file yet).
*/

// *** SETUP ***

var CONFIG = require ('./config.js');
var SECRET = require ('./secret.js');
var ENV    = process.argv [2] === 'local' ? undefined : process.argv [2];
var mode   = process.argv [3];

var crypto = require ('crypto');
var fs     = require ('fs');
var Path   = require ('path');
var os     = require ('os');
var https  = require ('https');
Error.stackTraceLimit = Infinity;

var dale   = require ('dale');
var teishi = require ('teishi');
var lith   = require ('lith');
var cicek  = require ('cicek');
var giz    = require ('giz');
var hitit  = require ('hitit');
var a      = require ('./assets/astack.js');

var redis    = require ('redis').createClient ({db: CONFIG.redisdb});
var uuid     = require ('uuid').v4;
var mailer   = SECRET.ses ? require ('nodemailer').createTransport (require ('nodemailer-ses-transport') (SECRET.ses)) : {sendmail: function (s, o) {
   console.log ('Mailer not configured! Please add AWS SES credentials in secret.js on the key `ses`');
   console.log ('Email not sent:', o);
}};

// *** CORE HELPER FUNCTIONS ***

var clog = console.log, type = teishi.type, eq = teishi.eq, last = teishi.last, inc = teishi.inc, reply = cicek.reply;
var stop = function (rs, rules) {
   return teishi.stop (rules, function (error) {
      reply (rs, 400, {error: error});
   }, true);
}
var astop = function (rs, path) {
   a.stop (path, function (s, error) {
      reply (rs, 500, {error: error});
   });
}
var mexec = function (s, multi) {
   multi.exec (function (error, data) {
      if (error) return s.next (null, error);
      s.next (data);
   });
}
var debug = function () {
   clog.apply (null, ['DEBUG'].concat (dale.go (arguments, function (v) {
      return v;
   })))
}

// TODO: use k.run once we have a new version of kaboot
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

// *** GIZ ***

giz.redis          = redis;
giz.config.expires = 7 * 24 * 60 * 60;

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

// *** SENDMAIL ***

var sendmail = function (s, o) {
   o.from1 = o.from1 || CONFIG.email.name;
   o.from2 = o.from2 || CONFIG.email.address;
   mailer.sendMail ({
      from:    o.from1 + ' <' + o.from2 + '>',
      to:      o.to1   + ' <' + o.to2   + '>',
      replyTo: o.from2,
      subject: o.subject,
      html:    lith.g (o.body),
   }, function (error) {
      if (error) notify (s, {priority: 'critical', type: 'mailer error', error: error, options: o});
      else       s.next ();
   });
}

// *** UNCAUGHT EXCEPTION HANDLER ***

process.on ('uncaughtException', function (error, origin) {
   error = {priority: 'critical', type: 'server error', error: error, stack: error.stack, origin: origin};
   // If this node fails, there's no guarantee that ak;ping will work, so we send an email first
   a.seq ([
      [sendmail, {
         to1: CONFIG.email.name,
         to2: CONFIG.email.address,
         subject: 'Critical error ac;tools',
         body:    ['pre', JSON.stringify (log, null, '   ')]
      }]
      // TODO: add ak;ping call as well
      function (s) {
         process.exit (1);
      }
   ]);
});

// *** HELPERS ***

var H = {};

// Adapted from https://www.regular-expressions.info/email.html
H.email = /^(?=[A-Z0-9][A-Z0-9@._%+-]{5,253}$)[A-Z0-9._%+-]{1,64}@(?:(?=[A-Z0-9-]{1,63}\.)[A-Z0-9]+(?:-[A-Z0-9]+)*\.){1,8}[A-Z]{2,63}$/i

H.mkdir = function (s, path) {
   a.seq (s, [k, 'mkdir', '-p', path]);
}

H.unlink = function (s, path, checkExistence) {
   if (! checkExistence) return a.seq (s, [a.make (fs.unlink), path]);

   fs.stat (path, function (error) {
      if (! error)                 return a.seq (s, [a.make (fs.unlink), path]);
      if (error.code === 'ENOENT') s.next ();
      else                         s.next (undefined, error);
   });
}

H.encrypt = function (path, cb) {
   // https://github.com/luke-park/SecureCompatibleEncryptionExamples/blob/master/JavaScript/SCEE-Node.js
   fs.readFile (path, function (error, file) {
      if (error) return cb (error);
      var nonce = crypto.randomBytes (CONFIG.crypto.nonceLength);
      var cipher = crypto.createCipheriv (CONFIG.crypto.algorithm, SECRET.crypto.password, nonce);
      var ciphertext = Buffer.concat ([cipher.update (file), cipher.final ()]);
      cb (null, Buffer.concat ([nonce, ciphertext, cipher.getAuthTag ()]));
   });
}

H.decrypt = function (data) {
   var nonce      = data.slice (0, CONFIG.crypto.nonceLength);
   var ciphertext = data.slice (CONFIG.crypto.nonceLength, data.length - CONFIG.crypto.tagLength);
   var tag        = data.slice (- CONFIG.crypto.tagLength);

   var cipher = crypto.createDecipheriv (CONFIG.crypto.algorithm, SECRET.crypto.password, nonce);
   cipher.setAuthTag (tag);
   return Buffer.concat ([cipher.update (ciphertext), cipher.final ()]);
}

H.s3put = function (s, key, path) {
   a.stop (s, [
      [a.make (H.encrypt), path],
      function (s) {
         s.time = Date.now ();
         s.next ();
      },
      [a.get, a.make (s3.upload, s3), {Key: key, Body: '@last'}],
      // TODO: add ak;stat call
      /*
      function (s) {
         H.stat.w (s, 'max', 'ms-s3put', Date.now () - s.time);
      },
      */
      [a.make (s3.headObject, s3), {Key: key}],
   ]);
}

H.s3get = function (s, key) {
   s3.getObject ({Key: key}, function (error, data) {
      if (error) return s.next (null, error);
      s.next (H.decrypt (data.Body));
   });
}

H.s3del = function (s, keys) {

   var counter = 0, t = Date.now ();
   if (type (keys) === 'string') keys = [keys];

   if (keys.length === 0) return s.next ();

   var batch = function () {
      s3.deleteObjects ({Delete: {Objects: dale.go (keys.slice (counter * 1000, (counter + 1) * 1000), function (key) {
         return {Key: key}
      })}}, function (error) {
         if (error) return s.next (null, error);
         if (++counter === Math.ceil (keys.length / 1000)) {
            H.stat.w (s, 'max', 'ms-s3del', Date.now () - t);
         }
         else batch ();
      });
   }

   batch ();
}

H.s3list = function (s, prefix) {
   var output = [];
   var fetch = function (marker) {
      s3.listObjects ({Prefix: prefix, Marker: marker}, function (error, data) {
         if (error) return s.next (null, error);
         output = output.concat (data.Contents);
         delete data.Contents;
         if (! data.IsTruncated) return s.next (dale.go (output, function (v) {return {key: v.Key, size: v.Size}}));
         fetch (output [output.length - 1].Key);
      });
   }
   fetch ();
}

H.lua = function () {
   // TODO: register if no script in node process memory, otherwise invoke with SHA.
}



// TODO ac;file code

// *** TAIL ***

var readline = require ('readline');

// max lines
// matching lines
var tail = function (path) {
   var proc   = require ('child_process').spawn ('tac', [path]);

   var rl = readline.createInterface ({
      input: proc.stdout
   });

   var c = 0, t = teishi.time ();

   rl.on ('line', function (line) {
      if (c > 10000000000000) {
         clog ('close', teishi.time () - t);
         return rl.close ();
      }
      c++;
      //clog ('che', line);
      line = JSON.parse (line);
      //clog (line.username);
      //clog ('line', dale.keys (line));
   });

   var wait = 3;

   var done = function () {
      clog ('done', teishi.time () - t);
   }

   dale.go (['stdout', 'stderr'], function (v) {
      proc [v].on ('data', function (chunk) {
         //if (v === 'stdout') clog ('line', chunk.length);
         if (v === 'stderr') clog (chunk + '');
      });
      proc [v].on ('end', done);
   });

   proc.on ('error', function (error) {
      done ();
   });
   proc.on ('exit',  function (code, signal) {
      done ();
   });

}

// *** AC:PULSE AGENT v0.1.0 ***
var acpulse = function (KEY, cberror) {
   var DOMAIN = 'http://localhost:2315/data/';
   var clog = console.log, cberror = cberror || function () {};
   var k = function (command, args, cb) {
      var stdout = '', stderr = '';
      var proc = require ('child_process').spawn (command, args);
      proc.stdout.on ('data', function (c) {stdout += c});
      proc.stderr.on ('data', function (c) {stderr += c});
      proc.on ('error', cberror);
      proc.on ('exit', function (code) {
         code ? cberror (stderr) : (cb || function () {}) (stdout);
      });
   }
   var one = function () {
      var output = {c: [], m: [], d: []};
      k ('top', ['-bn1'], function (Top) {
         Top.split ('\n').map (function (line) {
            lsplit = line.split (/\s+/);
            if (line.match ('Mem :')) lsplit.map (function (v, k) {
               if (v === 'total,') output.m [0] = Math.floor (parseInt (lsplit [k - 1]) / 1000);
               if (v === 'used,')  output.m [1] = Math.floor (parseInt (lsplit [k - 1]) / 1000);
            });
            if (line.match ('Cpu')) lsplit.map (function (v, k) {
               if (v === 'id,') output.c [1] = 100 - Math.round (parseFloat (lsplit [k - 1].replace (',', '.')));
            });
         });
         k ('getconf', ['_NPROCESSORS_ONLN'], function (nproc) {
            output.c [0] = parseInt (nproc.replace ('\n', ''));
            k ('df', [], function (df) {
               df.split ('\n').map (function (line) {
                  line = line.split (/\s+/);
                  var size = Math.floor (parseInt (line [1]) / 1000);
                  if (size > 5000) output.d.push ([line [5], size, Math.round (parseInt (line [2]) / 1000)]);
               });
               k ('wget', ['--post-data=' + JSON.stringify (output), '--header=Content-Type:application/json', DOMAIN + KEY]);
            });
         });
      });
   }
   one ();
   return setTimeout (one, 1000 * 60);
}
