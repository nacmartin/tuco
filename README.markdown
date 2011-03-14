Description
===========

Tuco is a simple application to store images found on the web in collections.

It is written in [node.js](http://nodejs.org/) using the [express framework](http://expressjs.com/).

It uses also:
 * [redis](http://redis.io) as database.
 * [jade](https://github.com/visionmedia/jade) as template engine.
 * [less](http://lesscss.org/) to extend traditional css.
 * [node-imagemagick](https://github.com/rsms/node-imagemagick) to create thumbnails.
 * [forever](https://github.com/indexzero/forever) to keep the server running even if it crashes somewhere.

You can get them via `npm`.

It includes a Firefox plugin to add an option in the contextual window opened clicking the right mouse button on an image. The plugin tries to access Tuco in the address http://localhost:3000 . You may want to change this.

It is more a pet project to learn node and redis than a complete and polished application. Users have not been implemented, but it is still useful for my personal use ;)

Running it
==========

After getting all the dependences (don't forget that you need a redis server!), you should be able to run `bash launcher.sh tuco.js` tu use `forever` or simply `node tuco.js`. 
