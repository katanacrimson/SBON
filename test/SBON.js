//
// SBON - JS library for working with SBON binary format.
// ---
// @copyright (c) 2017 Damian Bushong <katana@odios.us>
// @license MIT license
// @url <https://github.com/damianb/SBON>
//
/*jslint node: true, asi: true */
'use strict'

const { expect } = require('chai')
const SBON = require('./../SBON')
const ConsumableBuffer = require('ConsumableBuffer')
const ExpandingBuffer = require('ExpandingBuffer')
const bigInt = require('big-integer')

describe('SBON tests', () => {
	describe('SBON read functionality', () => {
		describe('SBON.readVarInt', () => {
			it('should throw if passed something other than a ConsumableBuffer or ConsumableFile', async () => {
				let res = null
				try {
					await SBON.readVarInt(null)
				} catch(err) {
					res = err
				}
				expect(res).to.be.an.instanceof(TypeError)
				expect(res.message).to.equal('SBON.readVarInt expects a ConsumableBuffer or ConsumableFile.')
			})

			it('should correctly parse a simple (one byte) unsigned varint', async () => {
				const buf = Buffer.from([0x58])
				const sbuf = new ConsumableBuffer(buf)

				const res = await SBON.readVarInt(sbuf)
				expect(res).to.equal(88)
			})

			it('should correctly parse a multibyte unsigned varint', async () => {
				const buf = Buffer.from([0x8E, 0x7C])
				const sbuf = new ConsumableBuffer(buf)

				const res = await SBON.readVarInt(sbuf)
				expect(res).to.equal(1916)
			})

			it('should correctly parse a large multibyte unsigned varint', async () => {
				const buf = Buffer.from([0xA5, 0xA0, 0xAF, 0xC7, 0x7F])
				const sbuf = new ConsumableBuffer(buf)

				const res = await SBON.readVarInt(sbuf)
				expect(res).to.equal(9999999999)
			})
		})

		describe('SBON.readVarIntSigned', () => {
			it('should throw if passed something other than a ConsumableBuffer or ConsumableFile', async () => {
				let res = null
				try {
					await SBON.readVarIntSigned(null)
				} catch(err) {
					res = err
				}
				expect(res).to.be.an.instanceof(TypeError)
				expect(res.message).to.equal('SBON.readVarIntSigned expects a ConsumableBuffer or ConsumableFile.')
			})

			it('should correctly parse a simple (one byte) signed varint', async () => {
				const buf = Buffer.from([0x01])
				const sbuf = new ConsumableBuffer(buf)

				const res = await SBON.readVarIntSigned(sbuf)
				expect(res).to.equal(-1)
			})

			it('should correctly parse a multibyte signed varint', async () => {
				const buf = Buffer.from([0xCC, 0x9D, 0x49])
				const sbuf = new ConsumableBuffer(buf)

				const res = await SBON.readVarIntSigned(sbuf)
				expect(res).to.equal(-624485)
			})

			it('should correctly parse a massive signed varint', async () => {
				const buf = Buffer.from([0xCA ,0xC0, 0xDF, 0x8F, 0x7E])
				const sbuf = new ConsumableBuffer(buf)

				const res = await SBON.readVarIntSigned(sbuf)
				expect(res).to.equal(9999999999)
			})
		})

		describe('SBON.readBytes', () => {
			it('should throw if passed something other than a ConsumableBuffer or ConsumableFile', async () => {
				let res = null
				try {
					await SBON.readBytes(null)
				} catch(err) {
					res = err
				}
				expect(res).to.be.an.instanceof(TypeError)
				expect(res.message).to.equal('SBON.readBytes expects a ConsumableBuffer or ConsumableFile.')
			})

			it('should return an empty Buffer if the length varint indicated such', async () => {
				const buf = Buffer.from([0x00, 0x01, 0x02])
				const sbuf = new ConsumableBuffer(buf)
				let expectBuffer = Buffer.alloc(0)

				const res = await SBON.readBytes(sbuf)

				expect(res).to.be.an.instanceof(Buffer)
				expect(Buffer.compare(res, expectBuffer)).to.equal(0)
			})

			it('should return the correct series of bytes', async () => {
				const buf = Buffer.from([0x02, 0xAA, 0x04, 0x00, 0xAA])
				const sbuf = new ConsumableBuffer(buf)

				let expectBuffer = Buffer.from([0xAA, 0x04])

				const res = await SBON.readBytes(sbuf)

				expect(res).to.be.an.instanceof(Buffer)
				expect(Buffer.compare(res, expectBuffer)).to.equal(0)
			})
		})

		describe('SBON.readString', () => {
			it('should throw if passed something other than a ConsumableBuffer or ConsumableFile', async () => {
				let res = null
				try {
					await SBON.readString(null)
				} catch(err) {
					res = err
				}
				expect(res).to.be.an.instanceof(TypeError)
				expect(res.message).to.equal('SBON.readString expects a ConsumableBuffer or ConsumableFile.')
			})

			it('should correctly parse an empty string', async () => {
				const buf = Buffer.from([0x00])
				const sbuf = new ConsumableBuffer(buf)

				const res = await SBON.readString(sbuf)
				expect(res).to.equal('')
			})

			it('should correctly parse a variable length string', async () => {
				const buf = Buffer.from([0x04, 0x6E, 0x61, 0x6D, 0x65])
				const sbuf = new ConsumableBuffer(buf)

				const res = await SBON.readString(sbuf)
				expect(res).to.equal('name')
			})
		})

		//
		// note: most of the Buffers we build here will have *extra* bytes included to ensure
		//   that we're not reading too far into the byte sequence.
		// tests here must be written with some extra beyond what is expected to be read.
		//
		describe('SBON.readDynamic', () => {
			it('should throw if passed something other than a ConsumableBuffer or ConsumableFile', async () => {
				let res = null
				try {
					await SBON.readDynamic(null)
				} catch(err) {
					res = err
				}
				expect(res).to.be.an.instanceof(TypeError)
				expect(res.message).to.equal('SBON.readDynamic expects a ConsumableBuffer or ConsumableFile.')
			})

			it('should parse and return a nil (null) value correctly', async () => {
				const buf = Buffer.from([0x01, 0x00, 0x00]) // with some extra bytes to throw things off!
				const sbuf = new ConsumableBuffer(buf)

				const res = await SBON.readDynamic(sbuf)
				expect(res).to.be.null
			})

			it('should parse and return a positive double correctly', async () => {
				const buf = Buffer.from([0x02, 0x40, 0x25, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xAA])
				const sbuf = new ConsumableBuffer(buf)

				const res = await SBON.readDynamic(sbuf)
				expect(res).to.equal(10.5)
			})

			it('should parse and return a negative double correctly', async () => {
				const buf = Buffer.from([0x02, 0xC0, 0x25, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xAA])
				const sbuf = new ConsumableBuffer(buf)

				const res = await SBON.readDynamic(sbuf)
				expect(res).to.equal(-10.5)
			})

			it('should parse and return a true boolean correctly', async () => {
				const buf = Buffer.from([0x03, 0x01, 0x00, 0x0A])
				const sbuf = new ConsumableBuffer(buf)

				const res = await SBON.readDynamic(sbuf)
				expect(res).to.equal(true)
			})

			it('should parse and return a false boolean correctly', async () => {
				const buf = Buffer.from([0x03, 0x00, 0x00, 0x0A])
				const sbuf = new ConsumableBuffer(buf)

				const res = await SBON.readDynamic(sbuf)
				expect(res).to.equal(false)
			})

			it('should parse and return a positive signed varint correctly', async () => {
				const buf = Buffer.from([0x04, 0x3C])
				const sbuf = new ConsumableBuffer(buf)

				const res = await SBON.readDynamic(sbuf)
				expect(res).to.equal(30)
			})

			it('should parse and return a negative signed varint correctly', async () => {
				const buf = Buffer.from([0x04, 0xCC, 0x9D, 0x49, 0x01, 0xAA])
				const sbuf = new ConsumableBuffer(buf)

				const res = await SBON.readDynamic(sbuf)
				expect(res).to.equal(-624485)
			})

			it('should parse and return a string correctly', async () => {
				const buf = Buffer.from([0x05, 0x04, 0x74, 0x65, 0x73, 0x74, 0x0A, 0x01])
				const sbuf = new ConsumableBuffer(buf)

				const res = await SBON.readDynamic(sbuf)
				expect(res).to.equal('test')
			})

			it('should parse and return a list correctly', async () => {
				const buf = Buffer.from([0x06, 0x01, 0x05, 0x01, 0x61])
				const sbuf = new ConsumableBuffer(buf)
				const expected = [
					'a'
				]

				const res = await SBON.readDynamic(sbuf)
				expect(res).to.deep.equal(expected)
			})

			it('should parse and return a map correctly', async () => {
				const buf = Buffer.from([
					0x07, 0x02, 0x04, 0x6B, 0x65, 0x79, 0x32, 0x05,
					0x04, 0x76, 0x61, 0x6C, 0x32, 0x03, 0x6B, 0x65,
					0x79, 0x05, 0x03, 0x76, 0x61, 0x6C
				])
				const sbuf = new ConsumableBuffer(buf)
				const expected = {
					key: 'val',
					key2: 'val2'
				}

				const res = await SBON.readDynamic(sbuf)
				expect(res).to.deep.equal(expected)
			})

			it('should throw an error when encountering an unexpected type', async () => {
				const buf = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00])
				const sbuf = new ConsumableBuffer(buf)
				let res = null
				try {
					const res = await SBON.readDynamic(sbuf)
				} catch(err) {
					res = err
				}
				expect(res).to.be.an.instanceof(Error)
				expect(res.message).to.equal('Unknown dynamic type 0x00 encountered in SBON.readDynamic')
			})
		})

		describe('SBON.readList', () => {
			it('should throw if passed something other than a ConsumableBuffer or ConsumableFile', async () => {
				let res = null
				try {
					await SBON.readList(null)
				} catch(err) {
					res = err
				}
				expect(res).to.be.an.instanceof(TypeError)
				expect(res.message).to.equal('SBON.readList expects a ConsumableBuffer or ConsumableFile.')
			})

			it('should parse a simple SBON list correctly', async () => {
				const buf = Buffer.from([0x01, 0x05, 0x01, 0x61])
				const sbuf = new ConsumableBuffer(buf)
				const expected = [
					'a'
				]

				const res = await SBON.readList(sbuf)
				expect(res).to.deep.equal(expected)
			})

			it('should parse a complex SBON list correctly', async () => {
				const buf = Buffer.from([
					0x03, 0x06, 0x01, 0x05, 0x01, 0x61, 0x06, 0x01,
					0x05, 0x01, 0x62, 0x06, 0x01, 0x05, 0x01, 0x63
				])
				const sbuf = new ConsumableBuffer(buf)
				const expected = [
					['a'],
					['b'],
					['c']
				]

				const res = await SBON.readList(sbuf)
				expect(res).to.deep.equal(expected)
			})
		})

		describe('SBON.readMap', () => {
			it('should throw if passed something other than a ConsumableBuffer or ConsumableFile', async () => {
				let res = null
				try {
					await SBON.readMap(null)
				} catch(err) {
					res = err
				}
				expect(res).to.be.an.instanceof(TypeError)
				expect(res.message).to.equal('SBON.readMap expects a ConsumableBuffer or ConsumableFile.')
			})

			it('should parse a simple SBON map correctly', async () => {
				const buf = Buffer.from([
					0x02, 0x04, 0x6B, 0x65, 0x79, 0x32, 0x05, 0x04,
					0x76, 0x61, 0x6C, 0x32, 0x03, 0x6B, 0x65, 0x79,
					0x05, 0x03, 0x76, 0x61, 0x6C
				])
				const sbuf = new ConsumableBuffer(buf)
				const expected = {
					key: 'val',
					key2: 'val2'
				}

				const res = await SBON.readMap(sbuf)
				expect(res).to.deep.equal(expected)
			})

			it('should parse a complex SBON map correctly', async () => {
				const buf = Buffer.from([
					0x02, 0x04, 0x6B, 0x65, 0x79, 0x31, 0x07, 0x01,
					0x04, 0x6B, 0x65, 0x79, 0x41, 0x05, 0x04, 0x76,
					0x61, 0x6C, 0x31, 0x04, 0x6B, 0x65, 0x79, 0x32,
					0x07, 0x01, 0x04, 0x6B, 0x65, 0x79, 0x42, 0x05,
					0x04, 0x76, 0x61, 0x6C, 0x31
				])
				const sbuf = new ConsumableBuffer(buf)
				const expected = {
					key1: { keyA: 'val1' },
					key2: { keyB: 'val1' }
				}

				const res = await SBON.readMap(sbuf)
				expect(res).to.deep.equal(expected)
			})
		})
	})

	describe('SBON write functionality', () => {
		describe('SBON.writeVarInt', () => {
			it('should throw if passed something other than an ExpandingBuffer or ExpandingFile', async () => {
				let res = null
				try {
					await SBON.writeVarInt(null)
				} catch(err) {
					res = err
				}
				expect(res).to.be.an.instanceof(TypeError)
				expect(res.message).to.equal('SBON.writeVarInt expects an ExpandingBuffer or ExpandingFile.')
			})

			it('should throw if passed something other than a number or BigInt instance for a value', async () => {
				let res = null
				const sbuf = new ExpandingBuffer()
				try {
					await SBON.writeVarInt(sbuf, null)
				} catch(err) {
					res = err
				}
				expect(res).to.be.an.instanceof(TypeError)
				expect(res.message).to.equal('SBON.writeVarInt expects a number or BigInt instance to be provided as the value to write.')
			})

			it('should correctly parse a simple (one byte) unsigned varint', async () => {
				const sbuf = new ExpandingBuffer()
				const expectedBuffer = Buffer.from([0x58])

				await SBON.writeVarInt(sbuf, 88)

				expect(Buffer.compare(sbuf.buf, expectedBuffer)).to.equal(0)
			})

			it('should correctly parse a multibyte unsigned varint', async () => {
				const sbuf = new ExpandingBuffer()
				const expectedBuffer = Buffer.from([0x8E, 0x7C])

				await SBON.writeVarInt(sbuf, 1916)

				expect(Buffer.compare(sbuf.buf, expectedBuffer)).to.equal(0)
			})

			it('should correctly parse a large multibyte unsigned varint', async () => {
				const sbuf = new ExpandingBuffer()
				const expectedBuffer = Buffer.from([0xA5, 0xA0, 0xAF, 0xC7, 0x7F])

				await SBON.writeVarInt(sbuf, 9999999999)

				expect(Buffer.compare(sbuf.buf, expectedBuffer)).to.equal(0)
			})
		})

		describe('SBON.writeVarIntSigned', () => {
			it('should throw if passed something other than an ExpandingBuffer or ExpandingFile', async () => {
				let res = null
				try {
					await SBON.writeVarIntSigned(null)
				} catch(err) {
					res = err
				}
				expect(res).to.be.an.instanceof(TypeError)
				expect(res.message).to.equal('SBON.writeVarIntSigned expects an ExpandingBuffer or ExpandingFile.')
			})

			it('should throw if passed something other than a number or BigInt instance for a value', async () => {
				let res = null
				const sbuf = new ExpandingBuffer()
				try {
					await SBON.writeVarIntSigned(sbuf, null)
				} catch(err) {
					res = err
				}
				expect(res).to.be.an.instanceof(TypeError)
				expect(res.message).to.equal('SBON.writeVarIntSigned expects a number or BigInt instance to be provided as the value to write.')
			})

			it('should correctly parse a simple (one byte) signed varint', async () => {
				const sbuf = new ExpandingBuffer()
				const expectedBuffer = Buffer.from([0x01])

				await SBON.writeVarIntSigned(sbuf, -1)

				expect(Buffer.compare(sbuf.buf, expectedBuffer)).to.equal(0)
			})

			it('should correctly parse a multibyte signed varint', async () => {
				const sbuf = new ExpandingBuffer()
				const expectedBuffer = Buffer.from([0xCC, 0x9D, 0x49])

				await SBON.writeVarIntSigned(sbuf, -624485)

				expect(Buffer.compare(sbuf.buf, expectedBuffer)).to.equal(0)
			})

			it('should correctly parse a massive signed varint', async () => {
				const sbuf = new ExpandingBuffer()
				const expectedBuffer = Buffer.from([0xCA ,0xC0, 0xDF, 0x8F, 0x7E])

				await SBON.writeVarIntSigned(sbuf, 9999999999)

				expect(Buffer.compare(sbuf.buf, expectedBuffer)).to.equal(0)
			})
		})

		describe('SBON.writeBytes', () => {
			it('should throw if passed something other than an ExpandingBuffer or ExpandingFile', async () => {
				let res = null
				try {
					await SBON.writeBytes(null)
				} catch(err) {
					res = err
				}
				expect(res).to.be.an.instanceof(TypeError)
				expect(res.message).to.equal('SBON.writeBytes expects an ExpandingBuffer or ExpandingFile.')
			})

			it('should throw if passed something other than a Buffer for a value', async () => {
				let res = null
				const sbuf = new ExpandingBuffer()
				try {
					await SBON.writeBytes(sbuf, null)
				} catch(err) {
					res = err
				}
				expect(res).to.be.an.instanceof(TypeError)
				expect(res.message).to.equal('SBON.writeBytes expects a Buffer to be provided as the value to write.')
			})

			it('should write a 0x00 byte only if provided an empty buffer (indicative of an empty string)', async () => {
				const buf = Buffer.alloc(0)
				const sbuf = new ExpandingBuffer(buf)
				let expectBuffer = Buffer.from([0x00])

				await SBON.writeBytes(sbuf, buf)

				expect(Buffer.compare(sbuf.buf, expectBuffer)).to.equal(0)
			})

			it('should correctly write the needed series of bytes (prefixed with a byte indicating the length of the series written)', async () => {
				const buf = Buffer.from([0xAA, 0x04])
				const sbuf = new ExpandingBuffer(buf)
				let expectBuffer = Buffer.from([0x02, 0xAA, 0x04])

				await SBON.writeBytes(sbuf, buf)

				expect(Buffer.compare(sbuf.buf, expectBuffer)).to.equal(0)
			})
		})

		describe('SBON.writeString', () => {
			it('should throw if passed something other than an ExpandingBuffer or ExpandingFile', async () => {
				let res = null
				try {
					await SBON.writeString(null)
				} catch(err) {
					res = err
				}
				expect(res).to.be.an.instanceof(TypeError)
				expect(res.message).to.equal('SBON.writeString expects an ExpandingBuffer or ExpandingFile.')
			})

			it('should throw if passed something other than a string for a value', async () => {
				let res = null
				const sbuf = new ExpandingBuffer()
				try {
					await SBON.writeString(sbuf, null)
				} catch(err) {
					res = err
				}
				expect(res).to.be.an.instanceof(TypeError)
				expect(res.message).to.equal('SBON.writeString expects a string to be provided as the value to write.')
			})

			it('should correctly write an empty string', async () => {
				const input = ''
				const sbuf = new ExpandingBuffer()
				const expectedBuffer = Buffer.from([0x00])

				await SBON.writeString(sbuf, input)
				expect(Buffer.compare(sbuf.buf, expectedBuffer)).to.equal(0)
			})

			it('should correctly write a variable length string', async () => {
				const input = 'name'
				const sbuf = new ExpandingBuffer()
				const expectedBuffer = Buffer.from([0x04, 0x6E, 0x61, 0x6D, 0x65])

				await SBON.writeString(sbuf, input)
				expect(Buffer.compare(sbuf.buf, expectedBuffer)).to.equal(0)
			})
		})

		describe('SBON.writeDynamic', () => {
			it('should throw if passed something other than an ExpandingBuffer or ExpandingFile', async () => {
				let res = null
				try {
					await SBON.writeDynamic(null)
				} catch(err) {
					res = err
				}
				expect(res).to.be.an.instanceof(TypeError)
				expect(res.message).to.equal('SBON.writeDynamic expects an ExpandingBuffer or ExpandingFile.')
			})

			it('should write a nil (null) value correctly', async () => {
				const sbuf = new ExpandingBuffer()
				const expectedBuffer = Buffer.from([0x01])

				await SBON.writeDynamic(sbuf, null)
				expect(Buffer.compare(sbuf.buf, expectedBuffer)).to.equal(0)
			})

			it('should write a positive double correctly', async () => {
				const sbuf = new ExpandingBuffer()
				const expectedBuffer = Buffer.from([0x02, 0x40, 0x25, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])

				await SBON.writeDynamic(sbuf, 10.5)

				expect(Buffer.compare(sbuf.buf, expectedBuffer)).to.equal(0)
			})

			it('should write a negative double correctly', async () => {
				const sbuf = new ExpandingBuffer()
				const expectedBuffer = Buffer.from([0x02, 0xC0, 0x25, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])

				await SBON.writeDynamic(sbuf, -10.5)

				expect(Buffer.compare(sbuf.buf, expectedBuffer)).to.equal(0)
			})

			it('should write a true boolean correctly', async () => {
				const sbuf = new ExpandingBuffer()
				const expectedBuffer = Buffer.from([0x03, 0x01])

				await SBON.writeDynamic(sbuf, true)

				expect(Buffer.compare(sbuf.buf, expectedBuffer)).to.equal(0)
			})

			it('should write a false boolean correctly', async () => {
				const sbuf = new ExpandingBuffer()
				const expectedBuffer = Buffer.from([0x03, 0x00])

				await SBON.writeDynamic(sbuf, false)

				expect(Buffer.compare(sbuf.buf, expectedBuffer)).to.equal(0)
			})

			it('should write a positive signed varint correctly', async () => {
				const sbuf = new ExpandingBuffer()
				const expectedBuffer = Buffer.from([0x04, 0x3C])

				await SBON.writeDynamic(sbuf, 30)

				expect(Buffer.compare(sbuf.buf, expectedBuffer)).to.equal(0)
			})

			it('should write a negative signed varint correctly', async () => {
				const sbuf = new ExpandingBuffer()
				const expectedBuffer = Buffer.from([0x04, 0xCC, 0x9D, 0x49])

				await SBON.writeDynamic(sbuf, -624485)

				expect(Buffer.compare(sbuf.buf, expectedBuffer)).to.equal(0)
			})

			it('should write a positive signed varint from a bigInt instance correctly', async () => {
				const sbuf = new ExpandingBuffer()
				const expectedBuffer = Buffer.from([0x04, 0xCC, 0x9D, 0x4A])

				const input = bigInt(624485)

				await SBON.writeDynamic(sbuf, input)

				expect(Buffer.compare(sbuf.buf, expectedBuffer)).to.equal(0)
			})

			it('should write a string correctly', async () => {
				const sbuf = new ExpandingBuffer()
				const expectedBuffer = Buffer.from([0x05, 0x04, 0x74, 0x65, 0x73, 0x74])

				await SBON.writeDynamic(sbuf, 'test')

				expect(Buffer.compare(sbuf.buf, expectedBuffer)).to.equal(0)
			})

			it('should write a list correctly', async () => {
				const sbuf = new ExpandingBuffer()
				const expectedBuffer = Buffer.from([0x06, 0x01, 0x05, 0x01, 0x61])

				const input = [
					'a'
				]

				await SBON.writeDynamic(sbuf, input)

				expect(Buffer.compare(sbuf.buf, expectedBuffer)).to.equal(0)
			})

			it('should write a map correctly', async () => {
				const sbuf = new ExpandingBuffer()
				const expectedBuffer = Buffer.from([
					0x07, 0x02, 0x04, 0x6B, 0x65, 0x79, 0x32, 0x05,
					0x04, 0x76, 0x61, 0x6C, 0x32, 0x03, 0x6B, 0x65,
					0x79, 0x05, 0x03, 0x76, 0x61, 0x6C
				])

				const input = {
					key2: 'val2',
					key: 'val'
				}

				await SBON.writeDynamic(sbuf, input)

				expect(Buffer.compare(sbuf.buf, expectedBuffer)).to.equal(0)
			})

			xit('should throw an error when encountering an unexpected type', async () => {
				//
				// not sure how to create this situation....
				//
				const buf = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00])
				const sbuf = new ConsumableBuffer(buf)
				let res = null
				try {
					const res = await SBON.readDynamic(sbuf)
				} catch(err) {
					res = err
				}
				expect(res).to.be.an.instanceof(Error)
				expect(res.message).to.equal('Unknown dynamic type 0x00 encountered in SBON.readDynamic')
			})
		})

		xdescribe('SBON.writeList', () => {
			it('should get tested')
		})

		xdescribe('SBON.writeMap', () => {
			it('should get tested')
		})
	})
})