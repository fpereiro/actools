var ENV = process.argv [2] === 'local' ? undefined : process.argv [2];

module.exports = {
   cookieName: 'ak' + (ENV ? '-' + ENV : ''),
   redisdb: ENV ? 7 : 13,
   email: {
      name:    'actools',
      address: 'info@altocode.nl'
   }
};

// Below is a template for creating secret.js. All UPPERCASE strings must be replaced by proper values.
/*
module.exports = {
   cookieSecret:       'COOKIESECRET',
   rootPassword:       'PASSWORD',
   cryptoPassword:     'CRYPTOSTRONGPASSWORD'
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
   }
}
*/
