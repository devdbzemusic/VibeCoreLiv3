package com.vibecore.app.nativeui

import android.content.ContentResolver
import android.content.Context
import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import java.nio.ByteBuffer
import java.nio.ByteOrder

/** Android-native encoded audio decode for Sample Forge / Groove assets. */
class AndroidAudioDecoder(private val context: Context) {

    data class DecodedPcm(
        val displayName: String,
        val mono: FloatArray,
        val sampleRate: Int,
        val sourceChannels: Int,
    )

    fun decode(uri: Uri): DecodedPcm {
        val extractor = MediaExtractor()
        var codec: MediaCodec? = null
        try {
            extractor.setDataSource(context, uri, null)
            val trackIndex = (0 until extractor.trackCount).firstOrNull { index ->
                extractor.getTrackFormat(index).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
            } ?: error("No audio track in selected file")

            val inputFormat = extractor.getTrackFormat(trackIndex)
            val mime = inputFormat.getString(MediaFormat.KEY_MIME) ?: error("Audio MIME missing")
            extractor.selectTrack(trackIndex)

            codec = MediaCodec.createDecoderByType(mime)
            codec.configure(inputFormat, null, null, 0)
            codec.start()

            val info = MediaCodec.BufferInfo()
            val output = FloatArrayBuilder()
            var inputDone = false
            var outputDone = false
            var sampleRate = inputFormat.intOr(MediaFormat.KEY_SAMPLE_RATE, 48000)
            var channels = inputFormat.intOr(MediaFormat.KEY_CHANNEL_COUNT, 1).coerceAtLeast(1)
            var pcmEncoding = AudioFormat.ENCODING_PCM_16BIT

            while (!outputDone) {
                if (!inputDone) {
                    val inputIndex = codec.dequeueInputBuffer(TIMEOUT_US)
                    if (inputIndex >= 0) {
                        val inputBuffer = codec.getInputBuffer(inputIndex) ?: error("Decoder input buffer unavailable")
                        val size = extractor.readSampleData(inputBuffer, 0)
                        if (size < 0) {
                            codec.queueInputBuffer(
                                inputIndex,
                                0,
                                0,
                                0L,
                                MediaCodec.BUFFER_FLAG_END_OF_STREAM,
                            )
                            inputDone = true
                        } else {
                            codec.queueInputBuffer(inputIndex, 0, size, extractor.sampleTime.coerceAtLeast(0L), 0)
                            extractor.advance()
                        }
                    }
                }

                when (val outputIndex = codec.dequeueOutputBuffer(info, TIMEOUT_US)) {
                    MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                        val format = codec.outputFormat
                        sampleRate = format.intOr(MediaFormat.KEY_SAMPLE_RATE, sampleRate)
                        channels = format.intOr(MediaFormat.KEY_CHANNEL_COUNT, channels).coerceAtLeast(1)
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && format.containsKey(MediaFormat.KEY_PCM_ENCODING)) {
                            pcmEncoding = format.getInteger(MediaFormat.KEY_PCM_ENCODING)
                        }
                    }
                    MediaCodec.INFO_TRY_AGAIN_LATER,
                    MediaCodec.INFO_OUTPUT_BUFFERS_CHANGED -> Unit
                    else -> if (outputIndex >= 0) {
                        val buffer = codec.getOutputBuffer(outputIndex)
                        if (buffer != null && info.size > 0) {
                            val view = buffer.duplicate().order(ByteOrder.nativeOrder())
                            view.position(info.offset)
                            view.limit(info.offset + info.size)
                            appendDownmixed(view.slice().order(ByteOrder.nativeOrder()), channels, pcmEncoding, output)
                        }
                        outputDone = info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
                        codec.releaseOutputBuffer(outputIndex, false)
                    }
                }
            }

            val mono = output.toArray()
            require(mono.isNotEmpty()) { "Decoded audio contains no PCM frames" }
            return DecodedPcm(
                displayName = displayName(context.contentResolver, uri),
                mono = mono,
                sampleRate = sampleRate,
                sourceChannels = channels,
            )
        } finally {
            try { codec?.stop() } catch (_: Exception) { }
            try { codec?.release() } catch (_: Exception) { }
            extractor.release()
        }
    }

    private fun appendDownmixed(
        buffer: ByteBuffer,
        channels: Int,
        pcmEncoding: Int,
        target: FloatArrayBuilder,
    ) {
        val ch = channels.coerceAtLeast(1)
        when (pcmEncoding) {
            AudioFormat.ENCODING_PCM_FLOAT -> {
                val samples = buffer.asFloatBuffer()
                while (samples.remaining() >= ch) {
                    var sum = 0f
                    repeat(ch) { sum += samples.get().coerceIn(-1f, 1f) }
                    target.add(sum / ch)
                }
            }
            else -> {
                val samples = buffer.asShortBuffer()
                while (samples.remaining() >= ch) {
                    var sum = 0f
                    repeat(ch) { sum += samples.get() / 32768f }
                    target.add((sum / ch).coerceIn(-1f, 1f))
                }
            }
        }
    }

    private fun displayName(resolver: ContentResolver, uri: Uri): String {
        resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (index >= 0) return cursor.getString(index)
            }
        }
        return uri.lastPathSegment ?: "sample"
    }

    private fun MediaFormat.intOr(key: String, fallback: Int): Int =
        if (containsKey(key)) getInteger(key) else fallback

    private class FloatArrayBuilder(initialCapacity: Int = 65536) {
        private var data = FloatArray(initialCapacity)
        private var size = 0

        fun add(value: Float) {
            if (size == data.size) data = data.copyOf((data.size * 2).coerceAtLeast(1))
            data[size++] = value
        }

        fun toArray(): FloatArray = data.copyOf(size)
    }

    companion object {
        private const val TIMEOUT_US = 10_000L
    }
}
