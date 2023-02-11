# ac;tools :: all our services are belong to you

> "Electrolytes! Enterprise!" -- brand consultant

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

## Why use services instead of using an established cloud provider?

See the section on Simplicity above.

## Why use ac;tools instead of rolling your own services?

As a general rule, you should only use ac;tools if you really, really like the APIs we offer.

Some explicit reasons:

- A simple solution to a common problem is already implemented and offered to you.
- Mekes scalability easier.
- Admins are provided.
- Admins allow powerful querying and graphing on existing data.

A word on scalability: the things that are hard to scale are those with state. If your API is stateless and refers to file & database services, is relatively easy to scale it (just add more servers! Or use a serverless solution instead). ac;tools intend to make this easier by offering you a scalable stateful layer on which your stateless API can rely.

## The seven services

- [**ac;id**](): identity.
- [**ac;db**](): database.
- [**ac;file**](): files.
- [**ac;log**](): logs.
- [**ac;stat**](): statistics.
- [**ac;queue**](): queues.
- [**ac;ping**](): notifications.

You can use any service without having to use the others.

## Cost

A fixed amount per month, plus linear (and at cost) extra cost for disk & database used. Requests and bandwidth are not charged but are capped on a per-second basis.

## Security

If you find a security vulnerability, please disclose it to us as soon as possible (`info AT altocode.nl`). We'll work on it with the utmost priority.

## API (rough draft)

### ac;id

Future

### ac;db

Future

### ac;file

File operations:
- Write: blob, options {path: PATH, s3: true|false}
- Read: path, head|tail: INT|UNDEFINED
- Delete: path

Metadata operations:
- List: prefix
- Get used space by prefix

Future:
   - Append

### ac;log

- Write: name, log
- Read: name, min: INT|UNDEFINED, max: INT|UNDEFINED, match: {...}, maxEntries: INT|UNDEFINED, sort: latest|earliest
- Delete: name, entry: STRING (\* for all) // (no need for reset since they're equivalent, since log names require no initialization/parameters)

Future:
   - Write logs with different date than present, requires reshuffling of storage

### ac;stat

- Write: name, type (flow|min|max|unique), value, date: INT|UNDEFINED (if no date provided, present moment is taken)
- Read: name, type (flow|min|max|unique), min: INT|UNDEFINED, max: INT|UNDEFINED, aggregateBy: s|m|h|d|M|y
- Delete: name, type
- List: prefix

### ac;queue

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

### ac;ping

- Create|update|delete user
- Create|update|delete group
- Create|update|delete alert: two types: 1) based on other services; 2) webhook (URL to be hit from outside).
   - Global constant: maximum one ping per minute, but on opening the dashboard see all alerts
- Pause alert

## Implementation (rough draft)

Initial version: no ac;id, no ac;db.

Conceptualized:
- Layer 1 is id and db. id needs its own db because otherwise there's a circular dependency between id and db that cannot be resolved.
- Layer 2 is file, log, stat and queue. Standalone services with dependencies with layer 1 and between themselves. Must map out interdependencies between ac;file and ac;stat to see if they go into infinite loops or not.
- Layer 3 is ping, only exists to respond to things that happen in Layer 1 and 2.

Conceptually from a user POV, file should belong to layer 1 (it's a fundamental storage unit, like db but in slower/larger storage), but implementation wise it belongs to Layer 2.

After bootstrap, all manual ssh logins to server are registered; idea is to make them asymptote to 0. Also info accesses that are not typical are also logged. Logs might be public too, though they might have to be expurgated of some info.

Nomadic infrastructure: servers run for n weeks, then are rotated (emptied, resetted, reinstalled and back in the mix).

Services run independently, but require each other.

Requirements:
- ac;id: none
- ac;db: ac;id
- ac;file: ac;id, ac;db, ac;stat, ac;queue
- ac;log: ac;id, ac;db and ac;file
- ac;stat: ac;id and ac;db
- ac;queue: ac;id and ac;db
- ac;ping: ac;id and ac;db; interacts with all services through hooks

## License

ac;tools is written by [Altocode](https://altocode.nl) and released into the public domain.
