//
// SBON - JS library for working with SBON binary format.
// ---
// @copyright (c) 2017 Damian Bushong <katana@odios.us>
// @license MIT license
// @url <https://github.com/damianb/SBON>
//
'use strict'

import { ConsumableBuffer } from 'ConsumableBuffer'
import { ConsumableFile } from 'ConsumableFile'
import { ExpandingBuffer } from 'ExpandingBuffer'
import { ExpandingFile } from 'ExpandingFile'
import * as bigInt from 'big-integer'

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
export class SBON {
  /**
   * Reads a variable integer from the provided ConsumableBuffer or ConsumableFile.
   * Relies on bigInt for mathematical operations as we're performing mathematical operations beyond JS's native capabilities.
   *
   * See also: <https://en.wikipedia.org/wiki/Variable-length_quantity>
   *
   * @param  {ConsumableBuffer|ConsumableFile} sbuf - The stream to read from.
   * @return {Promise:Number} - The javascript number form of the varint we just read.
   */
  static async readVarInt (sbuf: ConsumableBuffer|ConsumableFile): Promise<number> {
    let value = bigInt(0)
    while (true) {
      let b = await sbuf.read(1)
      let byte = bigInt(b.readUIntBE(0, 1))
      if (byte.and(0b10000000).isZero()) {
        value = value.shiftLeft(7).or(byte)
        if (value.isZero()) { // no, stop giving us -0! STAHP!
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
  static async readVarIntSigned (sbuf: ConsumableBuffer|ConsumableFile): Promise<number> {
    let value = bigInt(await this.readVarInt(sbuf))
    if (!value.and(1).isZero()) {
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
  static async readBytes (sbuf: ConsumableBuffer|ConsumableFile): Promise<Buffer> {
    // starts with a varint to indicate the length of the byte series
    const length = await this.readVarInt(sbuf)
    if (length > 0) {
      return sbuf.read(length)
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
  static async readString (sbuf: ConsumableBuffer|ConsumableFile): Promise<string> {
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
  static async readDynamic (sbuf: ConsumableBuffer|ConsumableFile): Promise<any> {
    // first byte of a dynamic type is always the type indicator
    const type = await sbuf.read(1)
    switch (type.readUIntBE(0, 1)) {
      case 1: // Nil-value
        return null
      case 2: // Double-precision float
        return (await sbuf.read(8)).readDoubleBE(0)
      case 3: // Boolean
        let byte = await sbuf.read(1)
        return (Buffer.compare(byte, Buffer.from([0x01])) === 0)
      case 4: // Signed varint
        return this.readVarIntSigned(sbuf)
      case 5: // String
        return this.readString(sbuf)
      case 6: // List
        return this.readList(sbuf)
      case 7: // Map
        return this.readMap(sbuf)
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
  static async readList (sbuf: ConsumableBuffer|ConsumableFile): Promise<Array<any>> {
    // first chunk is a varint that indicates the length of the list (how many array entries)
    // all values are dynamic types
    const length = await this.readVarInt(sbuf)
    let value = []
    let i = length
    while (i--) {
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
  static async readMap (sbuf: ConsumableBuffer|ConsumableFile): Promise<Object> {
    // first chunk is a varint that indicates the length of the map (how many key-value pairs)
    // keys are assumed strings, while values are dynamic types
    const length = await this.readVarInt(sbuf)
    let value: { [index:string] : any } = {}
    let i = length

    while (i--) {
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
   * @param  {bigInt|Number} value - The value to write.
   * @return {Promise:Number} - The return value of the sbuf.write() operation.
   */
  static async writeVarInt (sbuf: ExpandingBuffer|ExpandingFile, value: bigInt.BigInteger|number): Promise<number> {
    if (typeof value === 'number') {
      value = bigInt(value)
    }

    let bytes = []

    bytes.push(value.and(0b01111111).toJSNumber())
    value = value.shiftRight(7)
    while (!value.isZero()) {
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
   * @param  {bigInt|Number} value - The value to write.
   * @return {Promise:Number} - The return value of the sbuf.write() operation.
   */
  static async writeVarIntSigned (sbuf: ExpandingBuffer|ExpandingFile, value: bigInt.BigInteger|number) {
    if (typeof value === 'number') {
      value = bigInt(value)
    }

    if (value.lt(0)) {
      value = (value.add(1).times(-1)).shiftLeft(1).or(1)
    } else {
      value = value.shiftLeft(1)
    }

    return this.writeVarInt(sbuf, value.toJSNumber())
  }

  /**
   * Writes an array of bytes to the provided ExpandingBuffer or ExpandingFile.
   *
   * @param  {ExpandingBuffer|ExpandingFile} sbuf - The stream to write to.
   * @param  {Buffer} value - The Buffer instance to write.
   * @return {Promise:Number} - The return value of the sbuf.write() operation.
   */
  static async writeBytes (sbuf: ExpandingBuffer|ExpandingFile, value:Buffer): Promise<number> {
    await this.writeVarInt(sbuf, value.length)

    return sbuf.write(value)
  }

  /**
   * Writes a string to the provided ExpandingBuffer or ExpandingFile.
   * Most of the work here is done in writeBytes - we just transform the UTF-8 string into a Buffer instance.
   *
   * @param  {ExpandingBuffer|ExpandingFile} sbuf - The stream to write to.
   * @param  {String} value - The UTF-8 string to write.
   * @return {Promise:Number} - The return value of the sbuf.write() operation.
   */
  static async writeString (sbuf: ExpandingBuffer|ExpandingFile, value:string): Promise<number> {
    return this.writeBytes(sbuf, Buffer.from(value, 'utf8'))
  }

  /**
   * Write a dynamically-typed chunk of data to the provided ExpandingBuffer or ExpandingFile.
   * This farms out to the other SBON functions as necessary.
   *
   * @param  {ExpandingBuffer|ExpandingFile} sbuf - The stream to write to.
   * @param  {mixed} value - The value we want to write.  Accepts too many different types to document.
   * @return {Promise:Number} - The return value of the sbuf.write() operation.
   */
  static async writeDynamic (sbuf: ExpandingBuffer|ExpandingFile, value:any): Promise<number> {
    if (value === null) {
      // Nil-value
      return sbuf.write(0x01)
    } else if (typeof value === 'number' && (value === +value && value !== (value|0))) {
      // Double-precision float
      await sbuf.write(0x02)

      let input = Buffer.alloc(8)
      input.writeDoubleBE(value, 0)

      return sbuf.write(input)
    } else if (value === true || value === false) {
      // Boolean
      await sbuf.write(0x03)

      return sbuf.write(value ? 0x01 : 0x00)
    } else if (typeof value === 'number' || value instanceof bigInt) {
      // Signed varint
      await sbuf.write(0x04)

      return this.writeVarIntSigned(sbuf, value)
    } else if (typeof value === 'string') {
      // String
      await sbuf.write(0x05)

      return this.writeString(sbuf, value)
    } else if (Array.isArray(value)) {
      // List
      await sbuf.write(0x06)

      return this.writeList(sbuf, value)
    } else if (typeof value === 'object') {
      // Map
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
  static async writeList (sbuf: ExpandingBuffer|ExpandingFile, value: Array<any>): Promise<number> {
    let res: number = 0
    await this.writeVarInt(sbuf, value.length)
    for (const val of value) {
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
  static async writeMap (sbuf: ExpandingBuffer|ExpandingFile, value: { [index:string] : any }): Promise<number> {
    let res: number = 0
    let keys = Object.keys(value)

    await this.writeVarInt(sbuf, keys.length)
    for (const key of keys) {
      await this.writeString(sbuf, key)
      res = await this.writeDynamic(sbuf, value[key])
    }

    return res
  }
}
