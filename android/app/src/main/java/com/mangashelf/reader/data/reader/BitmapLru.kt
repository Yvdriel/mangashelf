package com.mangashelf.reader.data.reader

/**
 * Fixed-capacity LRU keyed by page index. On eviction (or replace, or [clear]) the displaced value
 * is handed to [onEvict] exactly once — `PageSource` wires that to `Bitmap::recycle`, which is the
 * point that keeps the bitmap heap bounded. Generic value + injected evictor keep it JVM-testable.
 *
 * Backed by an access-ordered [LinkedHashMap]: [get] promotes a key to most-recently-used, so the
 * key iteration order is eldest-first and [trim] always drops the least-recently-used page.
 */
class BitmapLru<V>(private val maxSize: Int, private val onEvict: (V) -> Unit) {

    private val map = LinkedHashMap<Int, V>(16, 0.75f, /* accessOrder = */ true)

    fun get(key: Int): V? = map[key]

    fun put(key: Int, value: V) {
        val prev = map.put(key, value)
        if (prev != null && prev !== value) onEvict(prev)
        trim()
    }

    private fun trim() {
        while (map.size > maxSize) {
            val eldest = map.keys.iterator().next()
            map.remove(eldest)?.let(onEvict)
        }
    }

    fun size(): Int = map.size

    fun keys(): List<Int> = map.keys.toList()

    fun clear() {
        val values = map.values.toList()
        map.clear()
        values.forEach(onEvict)
    }
}
