package com.mangashelf.reader.data.reader

import java.io.BufferedOutputStream
import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.io.File
import java.util.zip.CRC32
import java.util.zip.Deflater
import java.util.zip.DeflaterOutputStream

/**
 * Streams a real RGB PNG of arbitrary pixel dimensions WITHOUT ever allocating a full bitmap — only
 * one scanline (~width*3 bytes) is live at a time. This is the only way to author a >heap-size
 * fixture page (e.g. 4096×4096 = 64 MB if decoded un-sampled) on a device whose default app heap is
 * 48 MB: the OOM-pressure test must prove the *decoder* samples down, not that authoring is lucky.
 */
object LargePng {

    fun write(file: File, width: Int, height: Int) {
        DataOutputStream(BufferedOutputStream(file.outputStream())).use { out ->
            out.write(byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))

            val ihdr = ByteArrayOutputStream()
            DataOutputStream(ihdr).apply {
                writeInt(width)
                writeInt(height)
                writeByte(8) // bit depth
                writeByte(2) // colour type: truecolour RGB
                writeByte(0) // compression
                writeByte(0) // filter
                writeByte(0) // interlace
            }
            writeChunk(out, "IHDR", ihdr.toByteArray())

            val idat = ByteArrayOutputStream()
            DeflaterOutputStream(idat, Deflater(Deflater.DEFAULT_COMPRESSION)).use { z ->
                val row = ByteArray(1 + width * 3) // filter byte + RGB triples
                for (y in 0 until height) {
                    row[0] = 0 // filter type: none
                    var i = 1
                    val r = (y % 256).toByte()
                    for (x in 0 until width) {
                        row[i++] = r
                        row[i++] = (x % 256).toByte()
                        row[i++] = ((x + y) % 256).toByte()
                    }
                    z.write(row)
                }
            }
            writeChunk(out, "IDAT", idat.toByteArray())
            writeChunk(out, "IEND", ByteArray(0))
        }
    }

    private fun writeChunk(out: DataOutputStream, type: String, data: ByteArray) {
        out.writeInt(data.size)
        val typeBytes = type.toByteArray(Charsets.US_ASCII)
        out.write(typeBytes)
        out.write(data)
        val crc = CRC32()
        crc.update(typeBytes)
        crc.update(data)
        out.writeInt(crc.value.toInt())
    }
}
