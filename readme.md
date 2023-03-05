# ac;tools :: all our services are belong to you

> "Electrolytes! Enterprise!" -- brand consultant

> "The Golden Rule of Platforms, "Eat Your Own Dogfood", can be rephrased as "Start with a Platform, and Then Use it for Everything." -- Steve Yegge

## About

ac;tools is a set of web services that can substitute certain common parts of the backend of a web application. ac;tools is built by [Altocode](https://altocode.nl). While the service itself is paid, Altocode freely shares the code for all purposes, including commercial ones.

To understand why we're sharing the source code of a commercial product, please read [our manifesto](http://federicopereiro.com/manifesto). If that's too long to read, in a nutshell: we want to share our code so that others can learn from it and contribute to us. Sharing is the way to progress.

All non-code documents related to the project are published in this [open folder](https://drive.google.com/drive/folders/1wxafe58S9w2Kz_n-8FJ2CvTLQ6aZqaty).

## Status

ac;tools is currently under development and has not been launched yet. We estimate to have an alpha by 2023.

The author wishes to thank [Browserstack](https://browserstack.com) for providing tools to test cross-browser compatibility.

## Simplicity

What makes ac;tools different to other providers of web services is simplicity. For a given service, we strive to find the very few features that will get the job done and present them in the clearest possible way. APIs should be short, clear and powerful. UIs should be self-explanatory. The overall complexity should be one or two zeroes less than that of comparable offerings.

Everyone loves simplicity but few uphold it, because it is hard, takes time and perhaps makes desirable features harder or impossible. ac;tools chooses simplicity over everything else.

Making the complex simple. Making the complex beautiful.

## Why use these services instead of using an established cloud provider?

See the section on Simplicity above.

Also, this is 100% open source, and it is straightforward to self-host it if you so prefer.

## Why use ac;tools instead of rolling your own services?

As a general rule, you should only use ac;tools if you really, really like the APIs we offer.

Some explicit reasons:

- A simple solution to a common problem is already implemented and offered to you.
- It is scalable, meaning that it can run in multiple nodes maintaining consistency.
- A single admin (*admincito*) allows you to see and control what's going on.

A word on scalability: the things that are hard to scale are those with state. If your API is stateless and refers to file & database services, is relatively easy to scale it (just add more servers! Or use a serverless solution instead). ac;tools intend to make this easier by offering you a scalable stateful layer on which your stateless API can rely.

## The seven services

- [**ak;id**](): identity.
- [**ak;db**](): database.
- [**ak;file**](): files.
- [**ak;log**](): logs.
- [**ak;stat**](): statistics.
- [**ak;queue**](): queues.
- [**ak;ping**](): notifications.

You can use any service without having to use the others.

## Cost

A fixed amount per month, plus linear (and at cost) extra cost for disk & database used. Requests and bandwidth are not charged but are capped on a per-second basis.

## Security

If you find a security vulnerability, please disclose it to us as soon as possible (`info AT altocode.nl`). We'll work on it with the utmost priority.

## Architecture

### Principles

1. All the services run in the same node.
2. All the services communicate with each other through HTTP(S) requests - [no backdoors](https://gist.github.com/chitchcock/1281611)! It doesn't matter if they are in the same node.
3. ak;db nodes have access to Redis and ak;file nodes have access to FS and S3. All service nodes have access to all other service nodes.
4. Multiple nodes can be added and removed; the same goes for FS and Redis resources. The resources should be scalable and the services should manage the scaling up and down.

### Nodes and state

To add multiple nodes, simply send traffic to them in the load balancer. Five services have stateless nodes, which means that any node can serve any request. Things get more interesting with the services that hold state in themselves rather than in another service: ak;db and ak;file.

The logic of determining the right data partition cannot be in the load balancer, because it is dynamic and part of the services themselves. So any node on a stateful service (ak;db or ak;file) must be able to proxy a request to a node in the relevant partition (its main node in a write, or any node in a read).

Once the right node is determined, assuming that the node isn't itself, then two problems must be solved: 1) the proxying node authenticate itself to the target node; 2) the communication being secure (if it's not going through localhost). As regards 1), the problem can be solved simply by proxying the credentials. The only cost here is that the auth check is done twice. As for 2), using HTTPS won't cut it, since HTTPS is done at the load balancer level, and we cannot reroute the request into the LB in the hopes that this time it will hit its target (there could be n such reentries, which would be costly and starkly inelegant). So there will have to be encrypted pipes between the nodes of the stateful services. If the network is private, the channels can be considered secure (perhaps). But a zero-trust network with encrypted pipes is the true solution.

Do we place a server in front of Redis in ak;db, like we do with ak;file? We must, so we can check the credentials of incoming requests without putting that logic in Redis itself. So each Redis node has an ak;db node in front of it with a certain role (main or replica).

## API (rough draft)

### Initialization

```
var ak = require ('altokumo') ({app: STRING, password: STRING});
```

### Main concepts

- App.
- App user.

### ak;id

- Signup: {verified: [false]|true, uniqueEmail: [true]|false}
- Login {username|email: ..., password: ...}
- Verify
- Authenticate
- Recover password
- Reset password
- Delete
- Edit (fields: username, email, data)
- List
- See failed logins

- Set rate limits (future)

- /auth/login -> creates a session // {username|email} or '...' for either username or email. We don't allow usernames to contain @.
- /auth/logout
- /auth/verify -> creates a verify email token for a given user. any other token for that user is deleted.
- /auth/recover -> creates a recovery token; any existing tokens are deleted.
- /auth/reset -> changes the password with a token
- /auth/changePassword -> changes the password without a token
- /auth/rename -> {old: username|email, new: username|email}

id.session (session, [csrf], function (error, user)
id.signup (..., function (error, user)
id.login (..., function (error, {session, csrf})
id.recover
id.reset
id.changePassword
id.logout
id.logoutAll
id.sessions

Possibilities to review: invites, whitelist, cap on number of users.

### ak;db

Future

### ak;file

File operations:
- Write: optional id, blob, options {path: PATH, s3: true|false, ttl: INT|UNDEFINED} - returns id
- Read: path, head|tail: INT|UNDEFINED
- Delete: path
- Append: id, path, blob - if id doesn't exist, it is created
- Set/remove ttl

Metadata operations:
- List: prefix
- Get used space by prefix

How is this better than S3?

- Backed by S3 (no advantage here, no disadvantage either).
- Only pay a flat fee for storage. We round up the GBs. Bandwidth is free and capped at a reasonable multiple of storage.
- Faster response and throughput.
- Fewer features, simpler interface. A web interface where you can truly query your files.

### ak;log

- Write: name, log
- Read: name, min: INT|UNDEFINED, max: INT|UNDEFINED, match: {...}, maxEntries: INT|UNDEFINED, sort: latest|earliest
- Delete: name, entry: STRING (\* for all) // (no need for reset since they're equivalent, since log names require no initialization/parameters)

Future:
   - Write logs with different date than present, requires reshuffling of storage

- filter:
   - and, or, not have no precedence. executed in the order they happen. allow parenthesis for subclauses.
   - access by path. single is a string/integer, multiple is array of strings/integers.
   - All dates are auto converted to timestamp in the client.
   - string: equality, inequality, contains, match (regex)
   - number: equality, <=, >=, <, >
- other query:
   - sort (also multiple)
   - limit
   - exclude/include fields
   - return lists of paths and values to inform further queries (only if paths/values are below N; eventually, do it with ranges too).
- queries are named. load/save. put in URL with name.
- autorefresh every 5 seconds.

Set rotation rules as well.

### ak;stat

- Write: name, type (flow|min|max|unique), value, date: INT|UNDEFINED (if no date provided, present moment is taken)
- Read: name, type (flow|min|max|unique), min: INT|UNDEFINED, max: INT|UNDEFINED, aggregateBy: s|m|h|d|M|y
- Delete: name, type
- List: prefix

Provide example script to get server data so it can be populated on a dashboard. Or do we need a service on top of ak;stat?

### ak;queue

- Create: name, maxSimultaneous
- Update: name, maxSimultaneous
- Reset: name
- Delete: name
- Add: data {...} (max size 2048 bytes)
- Pull:
- Report: type (ok|error), data {...}
- Get: (brings all data from the queue to see status)

Future:
   - Rotate ok/error items

Support locks in queue! This allows for synchronization of tasks that involve consistency.

### ak;ping

- Create|update|delete user
- Create|update|delete group
- Create|update|delete alert: two types: 1) based on other services; 2) webhook (URL to be hit from outside).
   - Global constant: maximum one ping per minute, but on opening the dashboard see all alerts
- Pause alert

Allow for alert to be sent on *absence* of log. This shows downtime without having to go and hit a server. Let them tell you how they're doing.

## Implementation (rough draft)

Initial version: no ak;db, each service has direct access to the database but on its own key prefix. The colon is the separator for all database keys. Prefixes:

- `aki` (id)
- `akd` (db, for future)
- `akf` (file)
- `akl` (log)
- `aks` (stat)
- `akq` (queue)
- `akp` (ping)

All the services run together as a single node. But they talk to each other through HTTP(S). This is the ultimate monolith service architecture.

Conceptualized:
- Layer 1 is id and db. id needs its own db because otherwise there's a circular dependency between id and db that cannot be resolved.
- Layer 2 is file, log, stat and queue. Standalone services with dependencies with layer 1 and between themselves.
- Layer 3 is ping, only exists to respond to things that happen in Layer 1 and 2.

Conceptually from a user POV, file should belong to layer 1 (it's a fundamental storage unit, like db but in slower/larger storage), but implementation wise it belongs to Layer 2.

After bootstrap, all manual ssh logins to server are registered; idea is to make them asymptote to 0. Also info accesses that are not typical are also logged. Logs might be public too, though they might have to be expurgated of some info.

Nomadic infrastructure: servers run for n weeks, then are rotated (emptied, resetted, reinstalled and back in the mix).

Services run independently, but require each other.

Requirements:
- ak;id: none
- ak;db: ak;id
- ak;file: ak;id, ak;db, ak;stat, ak;queue
- ak;log: ak;id, ak;db and ak;file
- ak;stat: ak;id, ak;db and ak;file
- ak;queue: ak;id and ak;db
- ak;ping: ak;id and ak;db; interacts with all services through hooks

Potential infinite loop between ak;file and ak;stat. It will not happen if there are guarantees that not every call from ak;file to ak;stat triggers a call back to ak;file (ie: some stuff in ak;db stays in disk for a while).

### ak;id

Altokumo users are those created against altokumo itself. There's a 1:1 between an app and an altokumo user, they are the same. Each app can create users (app users). App users cannot create further users, so the hierarchy is only one deep.

root user owns the root app. It is not an user per se in the system, just a username - its password is in plaintext in `secret.js`.

Each user gets a uuid, and keys are set to that. If username is changed, this doesn't affect the user ids. This also prevents restrictions in usernames.

Ops are done on behalf of user. So if a request is sent to another service, that user's limits affect it.

Simplification to the usual approach: no API keys! All requests are done with a cookie. If no cookie, login first. This means that each user has only "root access" over its own app, and there are no finegrained permissions. Interesting to see how far we can go with this.

If root user wants to use services, it logins with itself to use a cookie, just like the other services. Then the other services check against ak;id that the user is indeed root.

Return only alphanumeric tokens/sessions so there's no need to escape them. Concatenate two to have enough length.

As much as possible, no app properties. Let the app tell you (for example) how much each session should last.

Redis
u:APPID:USERID (hash) - user
   username
   email
   created (int)
   data: {...}

s:ID (string): APPID:USERID - session

t:APPID:TOKENID (string) - token

Indexes: email to userid, username to userid. Usernames are always unique within an app.

allow same email for different apps, but validate it in tagaway.
this precludes logging in with email if there's more than one account per email.

Basic rate limiting:
- Unauthenticated user (5 hits/second per IP, 10/minute)
- Authenticated user (100 hits/second per app?)

Metrics bound to an app are stored in userspace but are protected from deletion. They can be read but not updated/deleted. They count towards the app's limits.

General metrics are stored in altokumo userspace.

What about metrics belonging to an app user? Also costed to the app, but able to be broken down by user.

This is a general principle: when a service y uses a service x on behalf of a user u, u should be able to see the entries of service y on x, but without bbeing able to modify them directly. For example, the files of ak;log in ak;file. Certain prefixes should be only written by the app. This requires identifying those requests with extra auth to know they come from the service rather than the user!


id.auth (session) -> error or user; if error, {code: 400|403|500} 400 is expired, 403 if invalid session.

id.signup (username: ..., password: ..., email: OPTIONAL, emailToVerify: true|undefined, checks uniques). Can pass username as email if you want.

id.importUser (username: ..., passwordHash: ..., ...)

id.verifyEmail (username: ), generates token

id.verifyEmail (token: ), works or not to verify email

id.login (username|email: ..., password: ...)

id.changePassword (oldPassword: ..., newPassword: ...)

id.recoverPassword (username: )

id.resetPassword (token: ..., newPassword: ...)

id.sessions (username: ...)

id.getUser (username|email: ...)

id.setUserData ({...}, {overwrite: true|und})

id.listUsers

We cannot provide federated login to other third parties because you need to approve your app. Or maybe we can, we simply supply the call and handle the refresh/access tokens, and ask you to send the required parameters.

If it's really really necessary, we'll add API keys, but not for now.

Services as middleware, just call the service! no jwt tokens that you need to trust, and no shared state.

Rate limiting is naturally bounded with identity. What would be the simplest possible approach here, in terms of API?

Zero trust network, even localhost calls are done with cookies. But use HTTPS to avoid sending credentials in plain text when logging in.

How to avoid circularity between ak;id and ak;db? ak;id cannot call ak;db because then ak;db will validate the cookie against ak;id, triggering another call. Not using ak;db in ak;id is not viable because we need to scale. So we can add a way for ak;id to be trusted by ak;db - how to make a reasonable backdoor?

ak;db can use ak;id, but ak;id cannot rely on ak;db because there will be an infinite loop. ak;id could run an ak;db configured with hardcoded credentials. So the solution is for ak;db to have a "bypass" mode where certain credentials are accepted without further checking. In that way, ak;id can use ak;db. These credentials are very sensible, so we need to think further how to mitigate the security implications of this.


### ak;db

The goal is to provide a Redis system that:
- Provides [strong consistency](https://en.wikipedia.org/wiki/Strong_consistency).
- Can be (re)partitioned into multiple nodes while running.
- The user can decide how to split the data into nodes.

Terminology: *node* (a single Redis), a partition (a *main* node plus *replicas*), a *schema* determines the partitions. No *shard*, no *slave*.

If exposed as service, the easy way would be to do it over HTTP, but the performance hit will probably be killer. So probably websockets, with auth handshake.

All writes are directed to the corresponding main node, and reads are sent uniformly to the main and the replicas. If we add WAIT after every write, we ensure that the replicas are up-to-date for the next command coming in. This enables consistency at the memory level of all the Redises involved. Also we must config Redis to [stop accepting writes if there are issues communicating with the replicas](http://antirez.com/news/66).

For the time being, if we have any Redis down (main or replica), the data and dataspace concerned is unavailable. Deep analysis must happen so that failures are asymptotic.

Persistence to disk can be done through both RDB and AOF. We need to periodically place these in ak;file. This should not generate infinite recursion because while every one of these will generate a call back from ak;file, not all of those calls back from ak;file will generate a new storing of a dump. But, for this reason, we cannot do one line AOF appends, because that would send the system into infinite recursion.

Partitioning logic: there's a default node for an user. Everything goes there. But you can set up alternate nodes if the size is too big. We can put a limit of 4GB for now.
With Redis, we'll probably have to bill by how much you allocate, rather than how much you use. The reason is that the ratio between a user's size and that of a node is much bigger than on a FS system (allocations are on the same order of magnitude than node capacity); whereas with files, especially if we put a size limit of 2GB, they can fit anywhere. The other reason is that files can be kept anywhere, because there are no operations concerning two or more at the same time; whereas with DB, many operations involve multiple keys in a transactional way. In other words, with files, the file itself is the boundary of consistency, whereas with a db the boundary of consistency is the node.

The system must figure out to which node an operation goes, using the key information. For cases where there is no key information, one key should be given by the user.

For keyscan, if the prefix matches one, it's against that one, otherwise it goes against all relevant nodes.

Implementation: always get key weight and put it in the metadata for node usage per user.

Repartitioning logic:
The main partition for each user has the schema.
We should have a place where we block operations on keys being repartitioned, then wait until it's done. Formerly I thought about a system where multiple schemas could temporarily coexist, but the complexity burden is probably unmanaged. Quick repartitioning and blocking only on repartitioned keys sounds like a good compromise. Do not allow multiple repartitionings on the same keys to happen at the same times.
Also, keep a history of all schema changes.

Must get the keys from the commands.

Do not allow any operations (including eval or multi or operations with multiple keys) across nodes. Sidestep the entire consistency problem. Give the user the power to either keep the transactionality of a single node or acknowledge its loss.

Eventually: choose node location.

Only allow certain commands.Not the following: auth, bgrewriteaof, bgsave, client, cluster, command, config, dbsize, debug, to be continued

If a partition has one or more replica nodes but no main because of an outage, the partition is read-only until the outage is fixed. Same should be, actually, for any node being down in a partition, even a replica node.

Outages must have explanations and its root causes found and eliminated - unless they are network partitions over which we can have no control at this stage.

How to make partitioning easier for the user? Show the distribution of keys by prefixes, and how much space they take.

We can host ak;file and ak;db in the same server, but they're part of different services. This is the core thing. No more direct access to disk or to redis; rather, it is done through the service. This is the key point.

The entire thing should be reproducible from scratch: https://github.com/antirez/redis/issues/2463

Make sure that rdb and aof are not overwritten by Redis when backing them up!

### ak;file

Terminology: *node* (a single node.js with access to disks), a partition (a *main* node plus *replicas*), a *schema* determines the partitions. Banished terms: *shard*, *slave*.

For a given partition, the replica nodes should have the same size allocated than the main node.

Split every N bytes. Lock write or append queue when splitting.

Keep 1:1 local FS and S3, splitting of the file should be the same, so you have the listing of files as index; but should we keep a list of files anyway in DB?

Split into directories by first four characters of id. This brings the amount of files per directory down by between 10^5 and 10^6. This is not necessary in S3.

For splitting, add suffixes to file, like ".1", ".2" and so forth.

When appending to a file that's being splitted, hold the chunk in the client.

Hard case for consistency: thousands of requests per second appending (from ak;stat). This is

Use a queue for each file.

When appending, add to queue for that file.

When consuming operations on a file, if there's a lock, wait and retry.

Can we guarantee append order with multiple nodes? Only if we use a queue and process it in order. But this requires to add the chunks in queue memory, unless we put the chunks somewhere, but then that would make it only accessible by that node.

To partition the files into multiple file nodes, pick a random node weighted by the amount of available space (absolute rather than as a %, so you can have nodes with different sizes). The exception would be splitted files, which should be on the same node. But they actually shouldn't be in the same one, necessarily; the metadata should be able to handle that. So we need to know in which node there's a file.

ak;db partitioning is done through key, but the ak;file one is done in a weighted random way and the metadata is stored. This is possible also because it's not prohibitive to have this overhead, since there will be considerably less files than db keys.

S3 adds extra safety. We expose that.

What should be the lifecycle? Probably aiming for the most expensive Glacier after 30 days.

Investigate using a md5 header from S3 to check more than just the size of the bytes.

Protect certain paths for the use of other services (ak;log, for example).

No RAID, main node & replica node for each partition.

Add soft deletion operation.

Set up security in S3 so that even with the credentials of a node, files cannot be deleted or overwritten. However, this would preclude economic append operations, because each of these would create a replica! Append requires modification of existing assets, and modification of existing assets can be tantamount to deletion. So there's no sense in adding this level of security. But what safeguards could we have in case of server compromise? Perhaps a daily backup to another S3 bucket, done from other credentials or S3 itself, to limit the damage.

Every file is assumed to be chunked. A non chunked file simply has one chunk. Chunks are stored as FILEID:TIMESTAMP:CHUNKID (chunk id can be smaller in bytes than a uuid, but we should still check for uniqueness). S3 simply maps that.

Challenges:
- Thousands of log entries per second appended on the same file, then tailing them quickly to gather log info.
- Redis rdb/aof backups in a production setting.

### ak;log

Core query mechanism: stream files from ak;file from the end and apply transforms to them.

ak;file must support tailing files.

#### Annotated source code

For now, we only have annotated fragments of the code. This will be expanded comprehensively later.

We now define `POST /data`, the endpoint that will receive all incoming log data.

```javascript
   ['post', 'data', function (rq, rs) {
```

The body of the request must be an object containing only one key, `log`, which should also contain an object. Otherwise, the reply will be a 400 with body `{error: '...'}`.

```javascript
      if (stop (rs, [
         ['body', rq.body, 'object'],
         ['keys of body', dale.keys (rq.body), 'log', 'eachOf', teishi.test.equal],
         function () {return [
            ['body.log', b.log, 'object'],
         ]}
      ])) return;
   }],
```

We add the field `username` (with the username of the user writing the log) to the log object, as well as `t` (the timestamp of the present moment). Note that if either `username` or `t` were present in the original log, they will be overwritten.

```javascript
      rq.body.log.username = rq.user.username;
      rq.body.log.t        = new Date ();
```

We stringify the log, and append it to `CONFIG.logfile`, followed by a newline. The file at `CONFIG.logfile` will therefore consist of a list of stringified objects, each separated by a newline.

If the operation fails, the reply will be a 500 with the body `{error: ...}`. Otherwise, the reply will be a 200.

```javascript
      fs.appendFile (CONFIG.logfile, JSON.stringify (rq.body.log) + '\n', cbreply (rs, true));
```

We now invoke the notification function defined at `SECRET`, passing the log, the response itself, plus the `type` and `sendmail` options (since these two are required dependencies). This is a stopgap until we have an initial version of ac;ping which can then be integrated with ac;log.

```javascript
      // TODO: replace hardcoded notifications with ac;ping
      SECRET.notifications (rq.body.log, rs, type, sendmail);
```

We define `POST /dataout`, the endpoint for querying logs. This endpoint is a `POST` and not a `GET`, since the query parameters can easily be in the thousands of characters, while the length of the URI of a `GET` request is quite constrained. Despite this being a `POST`, this endpoint does not modify the user's data.

```javascript
   ['post', 'dataout', function (rq, rs) {
```

We make sure that the body is an object, containing only three fields:
- `filter`: an array of conditions that can exclude certain entries.
- `sort`: an object, an array, or `undefined`. Determines the order in which the resulting entries are shown.
- `limit`: a positive integer, which determines the maximum amount of entries returned.

If one or more of these conditions are not met, of the conditions, the reply will be a 400 with body `{error: '...'}`.

TODO: The definition of `filter` must be specified and validated.

```javascript
      if (stop (rs, [
         ['body', rq.body, 'object'],
         ['keys of body', dale.keys (rq.body), ['filter', 'sort', 'limit'], 'eachOf', teishi.test.equal],
         function () {return [
            ['body.filter', rq.body.filter, 'array', 'oneOf'],
            // TODO: add filter validation
            ['body.sort',   rq.body.sort,   ['object', 'array', 'undefined'], 'oneOf'],
            ['body.limit',  rq.body.limit,  'integer'],
            ['body.limit',  rq.body.limit, {min: 1}, teishi.test.range]
         ]},
      ])) return;
```

If no `sort` field is present, we initialize it to an object representing sorting by time, with the most recent entries first.

```javascript
      if (! rq.body.sort) rq.body.sort = {field: 't', reverse: true};
```

### ak;stat

A stock variable is the integral of the flow variable. By always holding the integral (sum), we always have the stock, so the user doesn't have to either set both stock and flow, or choose only one.

types:
   counter
   max/min
   unique

Resolutions: second minute hour day month year
Sequence: once it's done, set in stone (disk/file, with tail?)

- counter: total hits, average speed (count both length and number, then divide)
- max/min: slowest/fastest

script load on loading of the server.

when deleting counter, track date, so if retrieving from log, don't mark it? no, much better to delete it from logfiles or directly from the file for that counter!! THAT'd be easy!

when querying a counter, specify range of dates and unit.

storage: all in seconds, except for uniques which must have one per active unit.

can be converted to linear logs with second resolution, keep recent only in db.

## License

ac;tools is written by [Altocode](https://altocode.nl) and released into the public domain.
