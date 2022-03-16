var ENV = process.argv [2] === 'local' ? undefined : process.argv [2];

module.exports = {
   port: 1121,
   logfile: '/root/files/logs.json',
   cookieName: 'aclog' + (ENV ? '-' + ENV : ''),
   backupFrequency: 1
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
