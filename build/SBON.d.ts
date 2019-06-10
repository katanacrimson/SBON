/// <reference types="node" />
import * as bigInt from 'big-integer';
import { ConsumableResource, ExpandingResource } from 'byteaccordion';
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
export declare class SBON {
    /**
     * Reads a variable integer from the provided ConsumableBuffer or ConsumableFile.
     * Relies on bigInt for mathematical operations as we're performing mathematical operations beyond JS's native capabilities.
     *
     * See also: <https://en.wikipedia.org/wiki/Variable-length_quantity>
     *
     * @param  sbuf - The resource to read from.
     * @return {Promise<number>} - The javascript number form of the varint we just read.
     */
    static readVarInt(sbuf: ConsumableResource): Promise<number>;
    /**
     * Reads a *signed* variable integer from the provided ConsumableBuffer or ConsumableFile.
     * Relies on bigInt for mathematical operations as we're performing mathematical operations beyond JS's native capabilities.
     *
     * See also: <https://en.wikipedia.org/wiki/Variable-length_quantity>
     *
     * @param  sbuf - The resource to read from.
     * @return {Promise<number>} - The javascript number form of the signed varint we just read.
     */
    static readVarIntSigned(sbuf: ConsumableResource): Promise<number>;
    /**
     * Reads a series of bytes from the provided ConsumableBuffer or ConsumableFile.
     * We expect that the first thing read will be a varint which will indicate how many bytes overall we will need to read.
     * This is commonly used for a UTF-8 string, with a varint indicating how many bytes will compose the string.
     *
     * @param  sbuf - The resource to read from.
     * @return {Promise<Buffer>} - A buffer instance containing the bytes read.
     */
    static readBytes(sbuf: ConsumableResource): Promise<Buffer>;
    /**
     * Reads a series of bytes from the provided ConsumableBuffer or ConsumableFile and reencodes them into a string.
     * Most of the work here is done in readBytes - we just transform the Buffer here into a UTF-8 stream after it's gotten our bytes.
     *
     * @param  sbuf - The resource to read from.
     * @return {Promise<string>} - A UTF-8 string.
     */
    static readString(sbuf: ConsumableResource): Promise<string>;
    /**
     * Reads a dynamic-typed chunk of data from the provided ConsumableBuffer or ConsumableFile.
     * Our first byte indicates the type, which then determines who will handle the rest.
     * This farms out to the other SBON functions as necessary.
     *
     * @param  sbuf - The resource to read from.
     * @return {Promise<any>} - Too many potential return types to document. You'll get something - can't really tell you what, though.
     */
    static readDynamic(sbuf: ConsumableResource): Promise<any>;
    /**
     * Reads a list from the provided ConsumableBuffer or ConsumableFile.
     *
     * @param  sbuf - The resource to read from.
     * @return {Promise<any[]>} - An Array used as a list.
     */
    static readList(sbuf: ConsumableResource): Promise<any[]>;
    /**
     * Reads a map (which we use a generic Object to represent) from the provided ConsumableBuffer or ConsumableFile.
     *
     * @param  sbuf - The resource to read from.
     * @return {Promise<Record<string, any>>} - An Object used as a key-value map.
     */
    static readMap(sbuf: ConsumableResource): Promise<Record<string, any>>;
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
    static writeVarInt(sbuf: ExpandingResource, value: bigInt.BigInteger | number): Promise<number>;
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
    static writeVarIntSigned(sbuf: ExpandingResource, value: bigInt.BigInteger | number): Promise<number>;
    /**
     * Writes an array of bytes to the provided ExpandingResource.
     *
     * @param  sbuf - The stream to write to.
     * @param  value - The Buffer instance to write.
     * @return {Promise<number>} - The return value of the sbuf.write() operation.
     */
    static writeBytes(sbuf: ExpandingResource, value: Buffer): Promise<number>;
    /**
     * Writes a string to the provided ExpandingResource.
     * Most of the work here is done in writeBytes - we just transform the UTF-8 string into a Buffer instance.
     *
     * @param  sbuf - The stream to write to.
     * @param  value - The UTF-8 string to write.
     * @return {Promise<number>} - The return value of the sbuf.write() operation.
     */
    static writeString(sbuf: ExpandingResource, value: string): Promise<number>;
    /**
     * Write a dynamically-typed chunk of data to the provided ExpandingResource.
     * This farms out to the other SBON functions as necessary.
     *
     * @param  sbuf - The stream to write to.
     * @param  value - The value we want to write.  Accepts too many different types to document.
     * @return {Promise<number>} - The return value of the sbuf.write() operation.
     */
    static writeDynamic(sbuf: ExpandingResource, value: any): Promise<number>;
    /**
     * Writes a list to the provided ExpandingResource.
     *
     * @param  sbuf - The resource to read from.
     * @param  value - The array we want to write.
     * @return {Promise<number>} - The return value of the sbuf.write() operation.
     */
    static writeList(sbuf: ExpandingResource, value: any[]): Promise<number>;
    /**
     * Writes an Object (also known as a map) to the provided ExpandingResource.
     *
     * @param  sbuf - The resource to read from.
     * @param  value - The object we want to write.
     * @return {Promise<number>} - The return value of the sbuf.write() operation.
     */
    static writeMap(sbuf: ExpandingResource, value: Record<string, any>): Promise<number>;
}
