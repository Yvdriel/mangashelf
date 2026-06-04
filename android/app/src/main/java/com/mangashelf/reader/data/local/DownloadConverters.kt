package com.mangashelf.reader.data.local

import androidx.room.TypeConverter
import com.mangashelf.reader.data.local.entities.DownloadState

/** Stores [DownloadState] as its name in a TEXT column. */
class DownloadConverters {

    @TypeConverter
    fun fromState(value: String): DownloadState = DownloadState.valueOf(value)

    @TypeConverter
    fun toState(state: DownloadState): String = state.name
}
