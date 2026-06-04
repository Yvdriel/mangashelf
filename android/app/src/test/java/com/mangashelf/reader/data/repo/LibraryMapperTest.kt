package com.mangashelf.reader.data.repo

import com.mangashelf.reader.data.remote.dto.MangaDto
import com.mangashelf.reader.data.remote.dto.VolumeDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

/** 3.1: DTO→entity mapping, with the `(mangaId, volumeNumber)` natural key and server-id retention. */
class LibraryMapperTest {

    private val dto = MangaDto(
        id = 7,
        anilistId = null,
        title = "Berserk",
        folderName = "Berserk [anilist-30002]",
        coverImage = "Berserk/.covers/sm.jpg",
        totalVolumes = 40,
        updatedAt = 1_717_862_350,
        volumes = listOf(
            VolumeDto(id = 501, volumeNumber = 1, folderName = "v01", pageCount = 150),
            VolumeDto(id = 502, volumeNumber = 2, folderName = "v02", pageCount = 165),
        ),
    )

    @Test
    fun mapsMangaFields() {
        val e = LibraryMapper.toMangaEntities(listOf(dto)).single()
        assertEquals(7, e.id)
        assertNull(e.anilistId)
        assertEquals("Berserk", e.title)
        assertEquals("Berserk/.covers/sm.jpg", e.coverImage)
        assertEquals(40, e.totalVolumes)
        assertEquals(1_717_862_350L, e.updatedAt)
    }

    @Test
    fun mapsVolumes_naturalKeyAndServerId_pinnedDefaultsFalse() {
        val vols = LibraryMapper.toVolumeEntities(listOf(dto))
        assertEquals(2, vols.size)

        val v2 = vols.single { it.volumeNumber == 2 }
        assertEquals(7, v2.mangaId)          // parent manga id
        assertEquals(502, v2.serverVolumeId) // churning server id retained
        assertEquals("v02", v2.folderName)
        assertEquals(165, v2.pageCount)
        assertFalse(v2.pinned)               // pin is client-owned, never from server
    }
}
