package com.mangashelf.reader.data.reader

/** Image-entry selection + ordering for a CBZ, kept pure (no Android types) so it is JVM-testable. */
object CbzIndex {

    private val IMAGE_EXTENSIONS = setOf("jpg", "jpeg", "png", "webp")

    /** Image entries only (by extension), in natural page order. Directory entries are dropped. */
    fun imageEntryNames(entryNames: List<String>): List<String> =
        entryNames
            .filter { name ->
                if (name.endsWith("/")) return@filter false
                val ext = name.substringAfterLast('/').substringAfterLast('.', "").lowercase()
                ext in IMAGE_EXTENSIONS
            }
            .sortedWith(PageOrder.comparator)
}
