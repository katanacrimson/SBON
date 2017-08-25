# SBON

## A node.js library for working with the "SBON" format (Starbound Binary Object Notation).

### What is SBON?

"SBON" is the community-created name for what appears to be a proprietary binary format, created by ChuckleFish for the game Starbound.
It seems to be highly like JSON and potentially a derivative of JSON/BSON.

For some documentation, see the reverse engineering notes on SBON, [available here](https://github.com/blixt/py-starbound/blob/master/FORMATS.md#sbon).

### How do I install this library?

Ensure you have at least node.js v7.6+, and then...

``` bash
$ npm i -s damianb/SBON
```

### How do I use this library?

First, ensure that you have ConsumableFile or ConsumableBuffer installed and available; all parsing in the SBON library requires one of these two objects.

In brief:

``` js
'use strict'
const SBON = require('SBON')
const ConsumableBuffer = require('ConsumableBuffer')

const sbuf = new ConsumableBuffer(Buffer.from([ /* Buffer contents here... */ ]))

SBON.readDynamic(sbuf).then(async (contents) => {
	console.dir(contents)
	// ^ gives you a native JS representation of what SBON just read from the ConsumableBuffer.
})
```

Full library documentation is available in the repository under the /docs/ directory.