# ac;tools :: all our services are belong to you

> "Electrolytes! Enterprise!" -- brand consultant

## About

ac;tools is a set of web services that can substitute certain common parts of the backend of a web application. ac;tools is built by [Altocode](https://altocode.nl). While the service itself is paid, Altocode freely shares the code for all purposes, including commercial ones.

To understand why we're sharing the source code of a commercial product, please read [our manifesto](http://federicopereiro.com/manifesto). If that's too long to read, in a nutshell: we want to share our code so that others can learn from it and contribute to us. Sharing is the way to progress.

All non-code documents related to the project are published in this [open folder](https://drive.google.com/drive/folders/1wxafe58S9w2Kz_n-8FJ2CvTLQ6aZqaty).

## Status

ac;tools is currently under development and has not been launched yet. We estimate to have an alpha by 2020.

The author wishes to thank [Browserstack](https://browserstack.com) for providing tools to test cross-browser compatibility.

## Simplicity

What makes ac;tools different to other providers of web services is simplicity. For a given service, we strive to find the very few features that will get the job done and present them in the clearest possible way. APIs should be short, clear and powerful. UIs should be self-explanatory. The overall complexity should be one or two zeroes less than that of comparable offerings.

Everyone loves simplicity but few uphold it, because it is hard, takes time and perhaps makes desirable features harder or impossible. ac;tools chooses simplicity over everything else.

Making the complex simple. Making the complex beautiful.

## The seven services

- [**ac;id**](): identity.
- [**ac;file**](): files.
- [**ac;db**](): database.
- [**ac;log**](): logs.
- [**ac;stat**](): statistics.
- [**ac;ping**](): notifications.
- [**ac;queue**](): queues.

You can use any service without having to use the others.

There are triggers for notifications on all the services.

## Why use services instead of rolling your own?

As a general rule, you should only use ac;tools if you really, really like the APIs we offer.

Some explicit reasons:

- A simple solution to a common problem is already implemented and offered to you.
- Mekes scalability easier.
- Admins are provided.
- Admins allow powerful querying and graphing on existing data.

A word on scalability: the things that are hard to scale are those with state. If your API is stateless and refers to file & database services, is relatively easy to scale it (just add more servers! Or use a serverless solution instead). ac;tools intend to make this easier by offering you a scalable stateful layer on which your stateless API can rely.

## Cost

A fixed amount per month, plus linear (and at cost) extra cost for disk & database used. Requests and bandwidth are not charged but are capped on a per-second basis.

## Security

If you find a security vulnerability, please disclose it to us as soon as possible (`info AT altocode.nl`). We'll work on it with the utmost priority.

## Internals (rough draft)

After bootstrap, all manual ssh logins to server are registered; idea is to make them asymptote to 0. Also info accesses that are not typical are also logged. Logs might be public too, though they might have to be expurgated of some info.

Nomadic infrastructure: servers run for n weeks, then are rotated (emptied, resetted, reinstalled and back in the mix).

Services run independently, but require each other.

Requirements:
- ac;id: none
- ac;db: ac;id
- ac;file: ac;id and ac;db
- ac;log: ac;id, ac;db and ac;file
- ac;stat: ac;id and ac;db
- ac;ping: ac;id and ac;db; interacts with all services through hooks
- ac;queue: ac;id and ac;db

## License

ac;tools is written by [Altocode](https://altocode.nl) and released into the public domain.
