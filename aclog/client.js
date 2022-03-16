// *** SETUP ***

var dale = window.dale, teishi = window.teishi, lith = window.lith, c = window.c, B = window.B;
var type = teishi.type, clog = teishi.clog, media = lith.css.media, style = lith.css.style, inc = function (a, v) {return a.indexOf (v) > -1}

return;

// TODO: IMPLEMENT & MOVE TO gotoB v2

   // *** DASHBOARD VIEW ***

   Views.dashboard = function (x) {
      var listen = [
         ['retrieve', 'data', function (x) {
            var filter = dale.stopNot (B.get ('Data', 'queries'), undefined, function (query, name) {
               if (name === B.get ('State', 'query')) return query.filter;
            });
            var t = Date.now ();
            B.say (x, 'notify', 'yellow', 'Loading...');
            H.authajax (x, 'post', 'dataout', {}, {filter: filter || []}, function (error, rs) {
               if (error) return B.say (x, 'notify', 'red', 'There was an error retrieving data.');
               B.say (x, 'set', ['Data', 'data'], rs.body);
               B.say (x, 'notify', 'green', rs.body.length + ' records retrieved in ' + ((Date.now () - t) / 1000) + ' s.');
            });
         }],
         ['retrieve', 'queries', function (x) {
            H.authajax (x, 'get', 'queries', {}, '', function (error, rs) {
               if (error) return B.say (x, 'notify', 'red', 'There was an error retrieving queries.');
               B.say (x, 'set', ['Data', 'queries'], rs.body);
            });
         }],
         ['save', 'query', function (x, which) {
            var query = teishi.c (B.get ('Data', 'queries', which));
            query.filter = teishi.p (B.get ('State', 'newfilter'));
            query.name   = which;
            H.authajax (x, 'post', 'query', {}, query, function (error) {
               if (error) return B.say (x, 'notify', 'red', 'There was an error saving the query.');
               B.say (x, 'rem', 'State', 'edit');
               B.say (x, 'rem', 'State', 'newfilter');
               B.say (x, 'retrieve', 'queries');
            });
         }],
         ['rename', 'query', function (x, oname) {
            var name  = prompt ('Enter the new name for the query', oname);
            if (! name) return;
            H.authajax (x, 'post', 'query/rename', {}, {oname: oname, name: name}, function (error) {
               if (error) {
                  if (error.responseText.match ('exists')) return B.say (x, 'notify', 'red', 'There already exists a query with that name.');
                  return B.say (x, 'notify', 'red', 'There was an error saving the query.');
               }
               if (State.query === oname) State.query = name;
               B.say (x, 'retrieve', 'queries');
            });
         }],
         ['create', 'query', function (x) {
            var name = prompt ('Enter the name for the query');
            if (! name) return;
            H.authajax (x, 'post', 'query', {}, {name: name, filter: []}, function (error) {
               if (error) {
                  if (error.responseText.match ('exists')) return B.say (x, 'notify', 'red', 'There already exists a query with that name.');
                  return B.say (x, 'notify', 'red', 'There was an error creating the new query.');
               }
               B.say (x, 'retrieve', 'queries');
            });
         }],
         ['delete', 'query', function (x, name) {
            H.authajax (x, 'post', 'query/delete', {}, {name: name}, function (error) {
               if (error) return B.say (x, 'notify', 'red', 'There was an error deleting the query.');
               if (State.query === name) B.say (x, 'rem', 'State', 'query');
               B.say (x, 'retrieve', 'queries');
            });
         }],
      ];

      return B.view (x, 'Data', {listen: listen, ondraw: function (x) {
         if (! B.get ('Data', 'data'))    return B.say (x, 'retrieve', 'data');
         if (! B.get ('Data', 'queries')) return B.say (x, 'retrieve', 'queries');
      }}, function (x, Data) {
         if (! Data || ! Data.data || ! Data.queries) return 'Loading...';
         var rows = ['t', 'tr', 'user', 'env', 'type'];
         dale.do (Data.data, function (v, k) {
            dale.do (v, function (v2, k2) {
               if (rows.indexOf (k2) === -1) rows.push (k2);
            });
         });
         return [
            ['style', [
               ['h3', {margin: 0}],
            ]],
            ['div', style ({'padding-top': 15, position: 'fixed', 'background-color': 'white', width: 1}), [
               ['h3', {class: 'floatl'}, ['span', B.ev ({class: 'action'}, ['onclick', 'retrieve', 'data']), 'refresh']],
               B.view (x, 'State', function (x, State) {
                  var selected = State.query;
                  return [
                     ['select', B.ev (style ({class: 'floatl'}, {'margin-left': 10}), [
                        ['onchange', 'set', ['State', 'query']],
                        ['onchange', 'set', ['State', 'newfilter'], JSON.stringify ((Data.queries [selected]) || {}.filter, null, '   ')],
                        ['onchange', 'retrieve', 'data'],
                     ]), [
                        ['option', 'Select one'],
                        dale.do (Data.queries, function (v, k) {
                           return ['option', {value: k, selected: selected === k}, k];
                        })],
                     ],
                     ['h3', B.ev (style ({class: 'action floatl'}, {'margin-left': 20}), ['onclick', 'create', 'query']), 'create'],
                     selected === undefined ? [] : [
                        ['h3', B.ev (style ({class: 'action floatl'}, {'margin-left': 20}), ['onclick', 'rename', 'query', selected]), 'rename'],
                        ['h3', B.ev (style ({class: 'action floatl'}, {'margin-left': 20}), ['onclick', 'delete', 'query', selected]), 'delete'],
                     ],
                     H.if (State.edit, [
                        ['textarea', B.ev (style ({class: 'floatl'}, {'width, height': 200, 'margin-left': 15}), ['oninput', 'set', ['State', 'newfilter']]), State.newfilter],
                        ['h3', ['span', B.ev (style ({class: 'action floatl'}, {'margin-left': 50}), ['onclick', 'save', 'query', selected]), 'save']],
                     ], [
                        selected === undefined ? [] : ['h3', ['span', B.ev (style ({class: 'action floatl'}, {'margin-left': 50}), [
                           ['onclick', 'set', ['State', 'edit'], true],
                           ['onclick', 'set', ['State', 'newfilter'], JSON.stringify (Data.queries [selected].filter, null, '   ')],
                        ]), 'edit']],
                     ]),
                  ];
               }),
               ['h3', B.ev (style ({class: 'action floatl'}, {'margin-left': 50}), ['onclick', 'logout', []]), 'logout'],
            ]],
            ['br'], ['br'], ['br'],
            ['table', {class: 'pure-table pure-table-striped pure-table-bordered'}, [
               ['thead', ['tr', dale.do (['#'].concat (dale.times (Math.min (Data.data.length, 100), 1)), function (v) {return ['th', v]})]],
               dale.do (rows, function (c) {
                  return ['tr', [
                     ['td', ['strong', c]],
                     dale.do (Data.data, function (v, k) {
                        if (k >= 100) return;
                        if (c === 'env')  c = 'environment';
                        if (c === 'user') c = 'username';
                        if (c === 't') return ['td', new Date (v [c]).toString ().replace (/\(.+/, '')];
                        if (c === 'tr') return ['td', (function () {
                           var diff = Math.round ((Date.now () - v.t) / 1000);
                           if (diff < 60) return diff + 's ago';
                           diff = (diff - diff % 60) / 60;
                           if (diff < 60) return diff + 'm ago';
                           diff = (diff - diff % 60) / 60;
                           if (diff < 24) return diff + 'h ago';
                           diff = (diff - diff % 24) / 24;
                           return diff + 'd ago';
                        }) ()];
                        return ['td', H.shorten (teishi.complex (v [c]) ? JSON.stringify (v [c], null, '   ') : v [c])];
                     }),
                  ]];
               }),
            ]],
         ];
      });
   }

