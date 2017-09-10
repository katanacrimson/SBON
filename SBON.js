//
// SBON - JS library for working with SBON binary format.
// ---
// @copyright (c) 2017 Damian Bushong <katana@odios.us>
// @license MIT license
// @url <https://github.com/damianb/SBON>
//
/*jslint node: true, asi: true */
'use strict'

const ConsumableBuffer = require('ConsumableBuffer')
const ConsumableFile = require('ConsumableFile')
const ExpandingBuffer = require('ExpandingBuffer')
const ExpandingFile = require('ExpandingFile')
const bigInt = require('big-integer')

//
// SBON - provides a library of functions for reading/parsing SBON ("Starbound Object Notation").
//
// lovingly ported from blixt's py-starbound sbon.py module
// @url <https://github.com/blixt/py-starbound/blob/master/starbound/sbon.py>
// @license MIT license
//
// for good Reverse-Engineering documentation on the SBON format, reference:
// <https://github.com/blixt/py-starbound/blob/master/FORMATS.md#sbon>
//
module.exports = class SBON {
	/**
	 * Reads a variable integer from the provided ConsumableBuffer or ConsumableFile.
	 * Relies on bigInt for mathematical operations as we're performing mathematical operations beyond JS's native capabilities.
	 *
	 * See also: <https://en.wikipedia.org/wiki/Variable-length_quantity>
	 *
	 * @param  {ConsumableBuffer|ConsumableFile} sbuf - The stream to read from.
	 * @return {Promise:Number} - The javascript number form of the varint we just read.
	 */
	static async readVarInt(sbuf) {
		if(!(sbuf instanceof ConsumableBuffer || sbuf instanceof ConsumableFile)) {
			throw new TypeError('SBON.readVarInt expects a ConsumableBuffer or ConsumableFile.')
		}

		let value = bigInt(0)
		while(true) {
			let byte = await sbuf.read(1)
			byte = bigInt(byte.readUIntBE(0, 1))
			if(byte.and(0b10000000).isZero()) {
				value = value.shiftLeft(7).or(byte)
				if(value.isZero()) { // no, stop giving us -0! STAHP!
					value = value.abs()
				}
				return value.toJSNumber()
			}
			value = value.shiftLeft(7).or(byte.and(0b01111111))
		}
	}

	/**
	 * Reads a *signed* variable integer from the provided ConsumableBuffer or ConsumableFile.
	 * Relies on bigInt for mathematical operations as we're performing mathematical operations beyond JS's native capabilities.
	 *
	 * See also: <https://en.wikipedia.org/wiki/Variable-length_quantity>
	 *
	 * @param  {ConsumableBuffer|ConsumableFile} sbuf - The stream to read from.
	 * @return {Promise:Number} - The javascript number form of the signed varint we just read.
	 */
	static async readVarIntSigned(sbuf) {
		if(!(sbuf instanceof ConsumableBuffer || sbuf instanceof ConsumableFile)) {
			throw new TypeError('SBON.readVarIntSigned expects a ConsumableBuffer or ConsumableFile.')
		}

		let value = bigInt(await this.readVarInt(sbuf))
		if(!value.and(1).isZero()) {
			return value.shiftRight(1).times(-1).minus(1).toJSNumber()
		} else {
			return value.shiftRight(1).toJSNumber()
		}
	}

	/**
	 * Reads a series of bytes from the provided ConsumableBuffer or ConsumableFile.
	 * We expect that the first thing read will be a varint which will indicate how many bytes overall we will need to read.
	 * This is commonly used for a UTF-8 string, with a varint indicating how many bytes will compose the string.
	 *
	 * @param  {ConsumableBuffer|ConsumableFile} sbuf - The stream to read from.
	 * @return {Promise:Buffer} - A buffer instance containing the bytes read.
	 */
	static async readBytes(sbuf) {
		if(!(sbuf instanceof ConsumableBuffer || sbuf instanceof ConsumableFile)) {
			throw new TypeError('SBON.readBytes expects a ConsumableBuffer or ConsumableFile.')
		}

		// starts with a varint to indicate the length of the byte series
		const length = await this.readVarInt(sbuf)
		if(length > 0) {
			return await sbuf.read(length)
		} else {
			return Buffer.alloc(0)
		}
	}

	/**
	 * Reads a series of bytes from the provided ConsumableBuffer or ConsumableFile and reencodes them into a string.
	 * Most of the work here is done in readBytes - we just transform the Buffer here into a UTF-8 stream after it's gotten our bytes.
	 *
	 * @param  {ConsumableBuffer|ConsumableFile} sbuf - The stream to read from.
	 * @return {Promise:String} - A UTF-8 string.
	 */
	static async readString(sbuf) {
		if(!(sbuf instanceof ConsumableBuffer || sbuf instanceof ConsumableFile)) {
			throw new TypeError('SBON.readString expects a ConsumableBuffer or ConsumableFile.')
		}

		return (await this.readBytes(sbuf)).toString('utf8')
	}

	/**
	 * Reads a dynamic-typed chunk of data from the provided ConsumableBuffer or ConsumableFile.
	 * Our first byte indicates the type, which then determines who will handle the rest.
	 * This farms out to the other SBON functions as necessary.
	 *
	 * @param  {ConsumableBuffer|ConsumableFile} sbuf - The stream to read from.
	 * @return {Promise:mixed} - Too many potential return types to document. You'll get something - can't really tell you what, though.
	 */
	static async readDynamic(sbuf) {
		if(!(sbuf instanceof ConsumableBuffer || sbuf instanceof ConsumableFile)) {
			throw new TypeError('SBON.readDynamic expects a ConsumableBuffer or ConsumableFile.')
		}

		// first byte of a dynamic type is always the type indicator
		const type = await sbuf.read(1)
		switch(type.readUIntBE(0, 1)) {
			case 1: // Nil-value
				return null
			case 2: // Double-precision float
				return (await sbuf.read(8)).readDoubleBE(0)
			case 3: // Boolean
				let byte = await sbuf.read(1)
				return (Buffer.compare(byte, Buffer.from([0x01])) === 0)
			case 4: // Signed varint
				return await this.readVarIntSigned(sbuf)
			case 5: // String
				return await this.readString(sbuf)
			case 6: // List
				return await this.readList(sbuf)
			case 7: // Map
				return await this.readMap(sbuf)
			default:
				throw new Error('Unknown dynamic type 0x' + type.toString('hex') + ' encountered in SBON.readDynamic')
		}
	}

	/**
	 * Reads a list from the provided ConsumableBuffer or ConsumableFile.
	 *
	 * @param  {ConsumableBuffer|ConsumableFile} sbuf - The stream to read from.
	 * @return {Promise:Array} - An Array used as a list.
	 */
	static async readList(sbuf) {
		if(!(sbuf instanceof ConsumableBuffer || sbuf instanceof ConsumableFile)) {
			throw new TypeError('SBON.readList expects a ConsumableBuffer or ConsumableFile.')
		}

		// first chunk is a varint that indicates the length of the list (how many array entries)
		// all values are dynamic types
		const length = await this.readVarInt(sbuf)
		let value = [], i = length
		while(i--) {
			const listVal = await this.readDynamic(sbuf)
			value.push(listVal)
		}

		return value
	}

	/**
	 * Reads a map (which we use a generic Object to represent) from the provided ConsumableBuffer or ConsumableFile.
	 *
	 * @param  {ConsumableBuffer|ConsumableFile} sbuf - The stream to read from.
	 * @return {Promise:Object} - An Object used as a key-value map.
	 */
	static async readMap(sbuf) {
		if(!(sbuf instanceof ConsumableBuffer || sbuf instanceof ConsumableFile)) {
			throw new TypeError('SBON.readMap expects a ConsumableBuffer or ConsumableFile.')
		}

		// first chunk is a varint that indicates the length of the map (how many key-value pairs)
		// keys are assumed strings, while values are dynamic types
		const length = await this.readVarInt(sbuf)
		let value = {}, i = length

		while(i--) {
			let key = await this.readString(sbuf)
			value[key] = await this.readDynamic(sbuf)
		}

		return value
	}

	/**
	 * Writes a variable integer to the provided ExpandingBuffer or ExpandingFile.
	 * Relies on bigInt for mathematical operations as we're performing mathematical operations beyond JS's native capabilities.
	 *
	 * See also: <https://en.wikipedia.org/wiki/Variable-length_quantity>
	 *
	 * @param  {ExpandingBuffer|ExpandingFile} sbuf - The stream to write to.
	 * @param  {Number} value - The value to write.
	 * @return {Promise:Number} - The return value of the sbuf.write() operation.
	 */
	static async writeVarInt(sbuf, value) {
		if(!(sbuf instanceof ExpandingBuffer || sbuf instanceof ExpandingFile)) {
			throw new TypeError('SBON.writeVarInt expects an ExpandingBuffer or ExpandingFile.')
		}

		if(typeof value !== 'number' && !(value instanceof bigInt)) {
			throw new TypeError('SBON.writeVarInt expects a number or BigInt instance to be provided as the value to write.')
		}

		if(typeof value === 'number') {
			value = bigInt(value)
		}

		let bytes = []

		bytes.push(value.and(0b01111111).toJSNumber())
		value = value.shiftRight(7)
		while(!value.isZero()) {
			bytes.unshift(value.and(0b01111111).or(0b10000000).toJSNumber())
			value = value.shiftRight(7)
		}

		return sbuf.write(Buffer.from(bytes))
	}

	/**
	 * Writes a *signed* variable integer to the provided ExpandingBuffer or ExpandingFile.
	 * Relies on bigInt for mathematical operations as we're performing mathematical operations beyond JS's native capabilities.
	 *
	 * See also: <https://en.wikipedia.org/wiki/Variable-length_quantity>
	 *
	 * @param  {ExpandingBuffer|ExpandingFile} sbuf - The stream to write to.
	 * @param  {Number} value - The value to write.
	 * @return {Promise:Number} - The return value of the sbuf.write() operation.
	 */
	static async writeVarIntSigned(sbuf, value) {
		if(!(sbuf instanceof ExpandingBuffer || sbuf instanceof ExpandingFile)) {
			throw new TypeError('SBON.writeVarIntSigned expects an ExpandingBuffer or ExpandingFile.')
		}

		// todo
	}

	/**
	 * Writes an array of bytes to the provided ExpandingBuffer or ExpandingFile.
	 *
	 * @param  {ExpandingBuffer|ExpandingFile} sbuf - The stream to write to.
	 * @param  {Buffer} value - The Buffer instance to write.
	 * @return {Promise:Number} - The return value of the sbuf.write() operation.
	 */
	static async writeBytes(sbuf, value) {
		if(!(sbuf instanceof ExpandingBuffer || sbuf instanceof ExpandingFile)) {
			throw new TypeError('SBON.writeBytes expects an ExpandingBuffer or ExpandingFile.')
		}

		if(!Buffer.isBuffer(value)) {
			throw new TypeError('SBON.writeBytes expects a Buffer to be provided as the value to write.')
		}

		await sbuf.write(value.length)

		return sbuf.write(value)
	}

	/**
	 * Reads a series of bytes from the provided ConsumableBuffer or ConsumableFile and reencodes them into a string.
	 * Most of the work here is done in readBytes - we just transform the Buffer here into a UTF-8 stream after it's gotten our bytes.
	 *
	 * @param  {ConsumableBuffer|ConsumableFile} sbuf - The stream to read from.
	 * @param  {String} value - The UTF-8 string to write.
	 * @return {Promise:Number} - The return value of the sbuf.write() operation.
	 */
	static async writeString(sbuf, value) {
		if(!(sbuf instanceof ExpandingBuffer || sbuf instanceof ExpandingFile)) {
			throw new TypeError('SBON.writeString expects an ExpandingBuffer or ExpandingFile.')
		}

		if(typeof value !== 'string') {
			throw new TypeError('SBON.writeString expects a string to be provided as the value to write.')
		}

		return this.writeBytes(sbuf, Buffer.from(value))
	}

	/**
	 * Write a dynamically-typed chunk of data to the provided ExpandingBuffer or ExpandingFile.
	 * This farms out to the other SBON functions as necessary.
	 *
	 * @param  {ExpandingBuffer|ExpandingFile} sbuf - The stream to write to.
	 * @param  {mixed} value - The value we want to write.  Accepts too many different types to document.
	 * @return {Promise:Number} - The return value of the sbuf.write() operation.
	 */
	static async writeDynamic(sbuf, value) {
		if(!(sbuf instanceof ExpandingBuffer || sbuf instanceof ExpandingFile)) {
			throw new TypeError('SBON.writeDynamic expects an ExpandingBuffer or ExpandingFile.')
		}

		let writeValue = null

		if(value === null) {
			return sbuf.write(0x01)
		} else if(parseInt(value, 10) !== value && parseFloat(value, 10) === value) {
			await sbuf.write(0x02)

			writeValue = Buffer.from(value)

			return sbuf.write(writeValue)
		} else if(value === true || value === false) {
			await sbuf.write(0x03)

			writeValue = value ? 0x01 : 0x00

			return sbuf.write(writeValue)
		} else if(typeof value === 'number') {
			// todo: big-integer support?
			// need to add instanceof check, along with doing the math to break down biginteger into a VLQ
			// might be something best handled in .writeVarInt and .writeVarIntSigned, though...
			await sbuf.write(0x04)

			return this.writeVarIntSigned(sbuf, value)
		} else if(typeof value === 'string') {
			await sbuf.write(0x05)

			return this.writeString(sbuf, value)
		} else if(Array.isArray(value)) {
			await sbuf.write(0x06)

			return this.writeList(sbuf, value)
		} else if(typeof value === 'object') {
			await sbuf.write(0x07)

			return this.writeMap(sbuf, value)
		} else {
			// at this point, we probably encountered something absolutely bizarre that we can't handle.
			// we're gonna have to puke.
			throw new TypeError('SBON.writeDynamic cannot identify a compatible SBON dynamic type for the provided value')
		}
	}

		/**
	 * Writes a list to the provided ExpandingBuffer or ExpandingFile.
	 *
	 * @param  {ExpandingBuffer|ExpandingFile} sbuf - The stream to read from.
	 * @param  {Array} value - The array we want to write.
	 * @return {Promise:Number} - The return value of the sbuf.write() operation.
	 */
	static async writeList(sbuf, value) {
		if(!(sbuf instanceof ExpandingBuffer || sbuf instanceof ExpandingFile)) {
			throw new TypeError('SBON.writeList expects an ExpandingBuffer or ExpandingFile.')
		}

		if(!Array.isArray(value)) {
			throw new TypeError('SBON.writeList expects an array to be provided as the value to write.')
		}

		let res = null
		await sbuf.write(value.length)
		for(val of value) {
			res = await this.writeDynamic(sbuf, val)
		}

		return res
	}

	/**
	 * Writes an Object (also known as a map) to the provided ExpandingBuffer or ExpandingFile.
	 *
	 * @param  {ExpandingBuffer|ExpandingFile} sbuf - The stream to read from.
	 * @param  {Object} value - The object we want to write.
	 * @return {Promise:Number} - The return value of the sbuf.write() operation.
	 */
	static async writeMap(sbuf, value) {
		if(!(sbuf instanceof ExpandingBuffer || sbuf instanceof ExpandingFile)) {
			throw new TypeError('SBON.writeMap expects an ExpandingBuffer or ExpandingFile.')
		}

		if(typeof value !== 'object') {
			throw new TypeError('SBON.writeMap expects an object to be provided as the value to write.')
		}

		let res = null
		let keys = Object.keys(value)

		await sbuf.write(keys.length)
		for(key of keys) {
			await this.writeString(sbuf, key)
			res = await this.writeDynamic(sbuf, value[key])
		}

		return res
	}
}