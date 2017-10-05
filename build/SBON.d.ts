/// <reference types="node" />
import { ConsumableBuffer } from 'ConsumableBuffer';
import { ConsumableFile } from 'ConsumableFile';
import { ExpandingBuffer } from 'ExpandingBuffer';
import { ExpandingFile } from 'ExpandingFile';
import * as bigInt from 'big-integer';
export declare class SBON {
    /**
     * Reads a variable integer from the provided ConsumableBuffer or ConsumableFile.
     * Relies on bigInt for mathematical operations as we're performing mathematical operations beyond JS's native capabilities.
     *
     * See also: <https://en.wikipedia.org/wiki/Variable-length_quantity>
     *
     * @param  {ConsumableBuffer|ConsumableFile} sbuf - The stream to read from.
     * @return {Promise:Number} - The javascript number form of the varint we just read.
     */
    static readVarInt(sbuf: ConsumableBuffer | ConsumableFile): Promise<number>;
    /**
     * Reads a *signed* variable integer from the provided ConsumableBuffer or ConsumableFile.
     * Relies on bigInt for mathematical operations as we're performing mathematical operations beyond JS's native capabilities.
     *
     * See also: <https://en.wikipedia.org/wiki/Variable-length_quantity>
     *
     * @param  {ConsumableBuffer|ConsumableFile} sbuf - The stream to read from.
     * @return {Promise:Number} - The javascript number form of the signed varint we just read.
     */
    static readVarIntSigned(sbuf: ConsumableBuffer | ConsumableFile): Promise<number>;
    /**
     * Reads a series of bytes from the provided ConsumableBuffer or ConsumableFile.
     * We expect that the first thing read will be a varint which will indicate how many bytes overall we will need to read.
     * This is commonly used for a UTF-8 string, with a varint indicating how many bytes will compose the string.
     *
     * @param  {ConsumableBuffer|ConsumableFile} sbuf - The stream to read from.
     * @return {Promise:Buffer} - A buffer instance containing the bytes read.
     */
    static readBytes(sbuf: ConsumableBuffer | ConsumableFile): Promise<Buffer>;
    /**
     * Reads a series of bytes from the provided ConsumableBuffer or ConsumableFile and reencodes them into a string.
     * Most of the work here is done in readBytes - we just transform the Buffer here into a UTF-8 stream after it's gotten our bytes.
     *
     * @param  {ConsumableBuffer|ConsumableFile} sbuf - The stream to read from.
     * @return {Promise:String} - A UTF-8 string.
     */
    static readString(sbuf: ConsumableBuffer | ConsumableFile): Promise<string>;
    /**
     * Reads a dynamic-typed chunk of data from the provided ConsumableBuffer or ConsumableFile.
     * Our first byte indicates the type, which then determines who will handle the rest.
     * This farms out to the other SBON functions as necessary.
     *
     * @param  {ConsumableBuffer|ConsumableFile} sbuf - The stream to read from.
     * @return {Promise:mixed} - Too many potential return types to document. You'll get something - can't really tell you what, though.
     */
    static readDynamic(sbuf: ConsumableBuffer | ConsumableFile): Promise<any>;
    /**
     * Reads a list from the provided ConsumableBuffer or ConsumableFile.
     *
     * @param  {ConsumableBuffer|ConsumableFile} sbuf - The stream to read from.
     * @return {Promise:Array} - An Array used as a list.
     */
    static readList(sbuf: ConsumableBuffer | ConsumableFile): Promise<Array<any>>;
    /**
     * Reads a map (which we use a generic Object to represent) from the provided ConsumableBuffer or ConsumableFile.
     *
     * @param  {ConsumableBuffer|ConsumableFile} sbuf - The stream to read from.
     * @return {Promise:Object} - An Object used as a key-value map.
     */
    static readMap(sbuf: ConsumableBuffer | ConsumableFile): Promise<Object>;
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
    static writeVarInt(sbuf: ExpandingBuffer | ExpandingFile, value: bigInt.BigInteger | number): Promise<number>;
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
    static writeVarIntSigned(sbuf: ExpandingBuffer | ExpandingFile, value: bigInt.BigInteger | number): Promise<number>;
    /**
     * Writes an array of bytes to the provided ExpandingBuffer or ExpandingFile.
     *
     * @param  {ExpandingBuffer|ExpandingFile} sbuf - The stream to write to.
     * @param  {Buffer} value - The Buffer instance to write.
     * @return {Promise:Number} - The return value of the sbuf.write() operation.
     */
    static writeBytes(sbuf: ExpandingBuffer | ExpandingFile, value: Buffer): Promise<number>;
    /**
     * Writes a string to the provided ExpandingBuffer or ExpandingFile.
     * Most of the work here is done in writeBytes - we just transform the UTF-8 string into a Buffer instance.
     *
     * @param  {ExpandingBuffer|ExpandingFile} sbuf - The stream to write to.
     * @param  {String} value - The UTF-8 string to write.
     * @return {Promise:Number} - The return value of the sbuf.write() operation.
     */
    static writeString(sbuf: ExpandingBuffer | ExpandingFile, value: string): Promise<number>;
    /**
     * Write a dynamically-typed chunk of data to the provided ExpandingBuffer or ExpandingFile.
     * This farms out to the other SBON functions as necessary.
     *
     * @param  {ExpandingBuffer|ExpandingFile} sbuf - The stream to write to.
     * @param  {mixed} value - The value we want to write.  Accepts too many different types to document.
     * @return {Promise:Number} - The return value of the sbuf.write() operation.
     */
    static writeDynamic(sbuf: ExpandingBuffer | ExpandingFile, value: any): Promise<number>;
    /**
     * Writes a list to the provided ExpandingBuffer or ExpandingFile.
     *
     * @param  {ExpandingBuffer|ExpandingFile} sbuf - The stream to read from.
     * @param  {Array} value - The array we want to write.
     * @return {Promise:Number} - The return value of the sbuf.write() operation.
     */
    static writeList(sbuf: ExpandingBuffer | ExpandingFile, value: Array<any>): Promise<number>;
    /**
     * Writes an Object (also known as a map) to the provided ExpandingBuffer or ExpandingFile.
     *
     * @param  {ExpandingBuffer|ExpandingFile} sbuf - The stream to read from.
     * @param  {Object} value - The object we want to write.
     * @return {Promise:Number} - The return value of the sbuf.write() operation.
     */
    static writeMap(sbuf: ExpandingBuffer | ExpandingFile, value: {
        [index: string]: any;
    }): Promise<number>;
}
