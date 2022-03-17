var ENV = process.argv [2] === 'local' ? undefined : process.argv [2];

var TEMPLATE = function (content) {
   return [
      ['head', [
         ['link', {rel: 'stylesheet', href: 'https://fonts.googleapis.com/css?family=Montserrat'}],
      ]],
      ['body', [
         ['style', [
            ['p', {'font-family': '\'Montserrat\', sans-serif'}],
         ]],
         content,
      ]],
   ];
}

var GREETING = function (username) {
   username = username [0].toUpperCase () + username.slice (1);
   return ['Hi ', ['span', username], ','];
}

module.exports = {
   port: 1121,
   redisdb: 4,
   logfile: '/root/files/logs.json',
   cookieName: 'aclog' + (ENV ? '-' + ENV : ''),
   backupFrequency: 1,
   etemplates: {
      welcome: {
         subject: 'Welcome to ac;tools!',
         message: function (username, token) {
            return TEMPLATE (['p', [
               GREETING (username),
               ['br'],
               'Welcome to ac;tools! We are thrilled to have you with us.',
               ['br'],
               'ac;toolsis just getting started; we would love to have your feedback. Feel free to tell us how we can make ac;toolswork better for you. When you have a moment, just hit "reply" to this email and let us know what you think.',
               ['br'], ['br'],
               'Have an amazing ' + ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] [new Date ().getDay ()] + '!',
               ['br'],
               ['span', {class: 'bold'}, 'The ac;tools team']
            ]]);
         }
      },
   }
}

// Below is a template for creating secret.js. All UPPERCASE strings must be replaced by proper values.
/*
module.exports = {
   cookieSecret: 'COOKIESECRET',
   whitelistedUsers: ['EMAIL1', ...],
   s3: {
      accessKeyId:     'ACCESSKEY',
      secretAccessKey: 'SECRETKEY',
      region:          'REGION',
      bucketName:      'BUCKETNAME'
   },
   ses: {
      accessKeyId:     'KEY',
      secretAccessKey: 'SECRETKEY',
      region:          'REGION'
   },
   emailAddress: 'EMAIL',
   emailName:    'NAME',
   aclog: {
      // Your ac;log credentials here. ac;log hasn't been published yet, so you can use an empty object instead.
   },
   notifications: function (rq, rs, type, sendmail) {
      // Optional logic for sending notifications for certain logs.
   }
}
*/
