//
// SBON - JS library for working with SBON binary format.
//
// @copyright (c) 2017 Damian Bushong <katana@odios.us>
// @license MIT license
// @url <https://github.com/damianb/SBON>
//

import * as bigInt from 'big-integer'

import { ConsumableResource, ExpandingResource } from 'ByteAccordion'

/**
 * SBON is a class of static methods which handles parsing and writing the proprietary SBON format ("Starbound Object Notation"),
 *   which is heavily used within Starbound archives and other files.
 *
 * As this library is heavily dependant on byte-level work and interpretation, it's highly recommended to first thoroughly review
 *   [the reverse engineering document](https://github.com/blixt/py-starbound/blob/master/FORMATS.md) and then review the source code for this SBON class itself.
 *
 * @note lovingly ported from blixt's py-starbound sbon.py module
 * @see <https://github.com/blixt/py-starbound/blob/master/starbound/sbon.py>
 * @license MIT license
 */
export class SBON {
  /**
   * Reads a variable integer from the provided ConsumableBuffer or ConsumableFile.
   * Relies on bigInt for mathematical operations as we're performing mathematical operations beyond JS's native capabilities.
   *
   * See also: <https://en.wikipedia.org/wiki/Variable-length_quantity>
   *
   * @param  sbuf - The resource to read from.
   * @return {Promise<number>} - The javascript number form of the varint we just read.
   */
  public static async readVarInt (sbuf: ConsumableResource): Promise<number> {
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
   * @param  sbuf - The resource to read from.
   * @return {Promise<number>} - The javascript number form of the signed varint we just read.
   */
  public static async readVarIntSigned (sbuf: ConsumableResource): Promise<number> {
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
   * @param  sbuf - The resource to read from.
   * @return {Promise<Buffer>} - A buffer instance containing the bytes read.
   */
  public static async readBytes (sbuf: ConsumableResource): Promise<Buffer> {
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
   * @param  sbuf - The resource to read from.
   * @return {Promise<string>} - A UTF-8 string.
   */
  public static async readString (sbuf: ConsumableResource): Promise<string> {
    return (await this.readBytes(sbuf)).toString('utf8')
  }

  /**
   * Reads a dynamic-typed chunk of data from the provided ConsumableBuffer or ConsumableFile.
   * Our first byte indicates the type, which then determines who will handle the rest.
   * This farms out to the other SBON functions as necessary.
   *
   * @param  sbuf - The resource to read from.
   * @return {Promise<any>} - Too many potential return types to document. You'll get something - can't really tell you what, though.
   */
  public static async readDynamic (sbuf: ConsumableResource): Promise<any> {
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
   * @param  sbuf - The resource to read from.
   * @return {Promise<any[]>} - An Array used as a list.
   */
  public static async readList (sbuf: ConsumableResource): Promise<any[]> {
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
   * @param  sbuf - The resource to read from.
   * @return {Promise<Object>} - An Object used as a key-value map.
   */
  public static async readMap (sbuf: ConsumableResource): Promise<{ [index: string]: any }> {
    // first chunk is a varint that indicates the length of the map (how many key-value pairs)
    // keys are assumed strings, while values are dynamic types
    const length = await this.readVarInt(sbuf)
    let value: { [index: string]: any } = {}
    let i = length

    while (i--) {
      let key = await this.readString(sbuf)
      value[key] = await this.readDynamic(sbuf)
    }

    return value
  }

  /**
   * Writes a variable integer to the provided ExpandingResource.
   * Relies on bigInt for mathematical operations as we're performing mathematical operations beyond JS's native capabilities.
   *
   * See also: <https://en.wikipedia.org/wiki/Variable-length_quantity>
   *
   * @param  sbuf - The stream to write to.
   * @param  value - The value to write.
   * @return {Promise<number>} - The return value of the sbuf.write() operation.
   */
  public static async writeVarInt (sbuf: ExpandingResource, value: bigInt.BigInteger | number): Promise<number> {
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
   * Writes a *signed* variable integer to the provided ExpandingResource.
   * Relies on bigInt for mathematical operations as we're performing mathematical operations beyond JS's native capabilities.
   *
   * See also: <https://en.wikipedia.org/wiki/Variable-length_quantity>
   *
   * @param  sbuf - The stream to write to.
   * @param  value - The value to write.
   * @return {Promise<number>} - The return value of the sbuf.write() operation.
   */
  public static async writeVarIntSigned (sbuf: ExpandingResource, value: bigInt.BigInteger | number): Promise<number> {
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
   * Writes an array of bytes to the provided ExpandingResource.
   *
   * @param  sbuf - The stream to write to.
   * @param  value - The Buffer instance to write.
   * @return {Promise<number>} - The return value of the sbuf.write() operation.
   */
  public static async writeBytes (sbuf: ExpandingResource, value: Buffer): Promise<number> {
    await this.writeVarInt(sbuf, value.length)

    return sbuf.write(value)
  }

  /**
   * Writes a string to the provided ExpandingResource.
   * Most of the work here is done in writeBytes - we just transform the UTF-8 string into a Buffer instance.
   *
   * @param  sbuf - The stream to write to.
   * @param  value - The UTF-8 string to write.
   * @return {Promise<number>} - The return value of the sbuf.write() operation.
   */
  public static async writeString (sbuf: ExpandingResource, value: string): Promise<number> {
    return this.writeBytes(sbuf, Buffer.from(value, 'utf8'))
  }

  /**
   * Write a dynamically-typed chunk of data to the provided ExpandingResource.
   * This farms out to the other SBON functions as necessary.
   *
   * @param  sbuf - The stream to write to.
   * @param  value - The value we want to write.  Accepts too many different types to document.
   * @return {Promise<number>} - The return value of the sbuf.write() operation.
   */
  public static async writeDynamic (sbuf: ExpandingResource, value: any): Promise<number> {
    if (value === null) {
      // Nil-value
      return sbuf.write(0x01)
    } else if (typeof value === 'number' && (value === +value && value !== (value | 0) && value % 1 !== 0)) {
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
   * Writes a list to the provided ExpandingResource.
   *
   * @param  sbuf - The resource to read from.
   * @param  value - The array we want to write.
   * @return {Promise<number>} - The return value of the sbuf.write() operation.
   */
  public static async writeList (sbuf: ExpandingResource, value: any[]): Promise<number> {
    let res: number = 0
    await this.writeVarInt(sbuf, value.length)
    for (const val of value) {
      res = await this.writeDynamic(sbuf, val)
    }

    return res
  }

  /**
   * Writes an Object (also known as a map) to the provided ExpandingResource.
   *
   * @param  sbuf - The resource to read from.
   * @param  value - The object we want to write.
   * @return {Promise<number>} - The return value of the sbuf.write() operation.
   */
  public static async writeMap (sbuf: ExpandingResource, value: { [index: string]: any }): Promise<number> {
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
