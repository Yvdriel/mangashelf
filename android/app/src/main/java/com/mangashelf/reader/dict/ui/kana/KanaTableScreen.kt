package com.mangashelf.reader.dict.ui.kana

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mangashelf.reader.ui.theme.NotoSansJp
import com.mudita.mmd.components.buttons.ButtonMMD
import com.mudita.mmd.components.text.TextMMD

/** Route wrapper. D2.5 kana reference has no engine/data dependency, so there is no ViewModel. */
@Composable
fun KanaTableRoute(onBack: () -> Unit) {
    KanaTableScreen(onBack)
}

/**
 * D2.5 — authored gojūon reference table. Holds its own hiragana/katakana toggle state; renders
 * the same authored cells with either script. Stateless of any backend so it Compose-tests without
 * Hilt.
 */
@Composable
fun KanaTableScreen(onBack: () -> Unit) {
    var katakana by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ButtonMMD(onClick = onBack) { TextMMD("Back") }
            Spacer(Modifier.width(8.dp))
            ButtonMMD(onClick = { katakana = false }) { TextMMD("Hiragana") }
            ButtonMMD(onClick = { katakana = true }) { TextMMD("Katakana") }
        }

        Spacer(Modifier.height(12.dp))
        TextMMD(if (katakana) "Katakana" else "Hiragana")
        Spacer(Modifier.height(8.dp))

        Column(
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState()),
        ) {
            KANA_ROWS.forEach { row ->
                KanaRow(row, katakana)
                Spacer(Modifier.height(8.dp))
            }
        }
    }
}

@Composable
private fun KanaRow(row: List<KanaCell>, katakana: Boolean) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        row.forEach { cell ->
            KanaCellView(cell, katakana, Modifier.weight(1f))
        }
        // Pad short rows (ya/wa/n) so the columns stay aligned with the 5-vowel rows.
        repeat(5 - row.size) {
            Spacer(Modifier.weight(1f))
        }
    }
}

@Composable
private fun KanaCellView(cell: KanaCell, katakana: Boolean, modifier: Modifier) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = if (katakana) cell.kata else cell.hira,
            fontFamily = NotoSansJp,
            fontSize = 24.sp,
            textAlign = TextAlign.Center,
        )
        Text(
            text = cell.romaji,
            fontSize = 12.sp,
            textAlign = TextAlign.Center,
        )
    }
}

/** One gojūon cell: paired hiragana/katakana glyphs and their shared romaji. */
data class KanaCell(val hira: String, val kata: String, val romaji: String)

/**
 * The authored table: the full base gojūon followed by the dakuten/handakuten groups
 * (が-row, ざ-row, だ-row, ば-row, ぱ-row). Short rows (ya/wa/n) intentionally have fewer cells.
 */
private val KANA_ROWS: List<List<KanaCell>> = listOf(
    // --- Base gojūon ---
    listOf(
        KanaCell("あ", "ア", "a"),
        KanaCell("い", "イ", "i"),
        KanaCell("う", "ウ", "u"),
        KanaCell("え", "エ", "e"),
        KanaCell("お", "オ", "o"),
    ),
    listOf(
        KanaCell("か", "カ", "ka"),
        KanaCell("き", "キ", "ki"),
        KanaCell("く", "ク", "ku"),
        KanaCell("け", "ケ", "ke"),
        KanaCell("こ", "コ", "ko"),
    ),
    listOf(
        KanaCell("さ", "サ", "sa"),
        KanaCell("し", "シ", "shi"),
        KanaCell("す", "ス", "su"),
        KanaCell("せ", "セ", "se"),
        KanaCell("そ", "ソ", "so"),
    ),
    listOf(
        KanaCell("た", "タ", "ta"),
        KanaCell("ち", "チ", "chi"),
        KanaCell("つ", "ツ", "tsu"),
        KanaCell("て", "テ", "te"),
        KanaCell("と", "ト", "to"),
    ),
    listOf(
        KanaCell("な", "ナ", "na"),
        KanaCell("に", "ニ", "ni"),
        KanaCell("ぬ", "ヌ", "nu"),
        KanaCell("ね", "ネ", "ne"),
        KanaCell("の", "ノ", "no"),
    ),
    listOf(
        KanaCell("は", "ハ", "ha"),
        KanaCell("ひ", "ヒ", "hi"),
        KanaCell("ふ", "フ", "fu"),
        KanaCell("へ", "ヘ", "he"),
        KanaCell("ほ", "ホ", "ho"),
    ),
    listOf(
        KanaCell("ま", "マ", "ma"),
        KanaCell("み", "ミ", "mi"),
        KanaCell("む", "ム", "mu"),
        KanaCell("め", "メ", "me"),
        KanaCell("も", "モ", "mo"),
    ),
    listOf(
        KanaCell("や", "ヤ", "ya"),
        KanaCell("ゆ", "ユ", "yu"),
        KanaCell("よ", "ヨ", "yo"),
    ),
    listOf(
        KanaCell("ら", "ラ", "ra"),
        KanaCell("り", "リ", "ri"),
        KanaCell("る", "ル", "ru"),
        KanaCell("れ", "レ", "re"),
        KanaCell("ろ", "ロ", "ro"),
    ),
    listOf(
        KanaCell("わ", "ワ", "wa"),
        KanaCell("を", "ヲ", "wo"),
    ),
    listOf(
        KanaCell("ん", "ン", "n"),
    ),
    // --- Dakuten / handakuten ---
    listOf(
        KanaCell("が", "ガ", "ga"),
        KanaCell("ぎ", "ギ", "gi"),
        KanaCell("ぐ", "グ", "gu"),
        KanaCell("げ", "ゲ", "ge"),
        KanaCell("ご", "ゴ", "go"),
    ),
    listOf(
        KanaCell("ざ", "ザ", "za"),
        KanaCell("じ", "ジ", "ji"),
        KanaCell("ず", "ズ", "zu"),
        KanaCell("ぜ", "ゼ", "ze"),
        KanaCell("ぞ", "ゾ", "zo"),
    ),
    listOf(
        KanaCell("だ", "ダ", "da"),
        KanaCell("ぢ", "ヂ", "ji"),
        KanaCell("づ", "ヅ", "zu"),
        KanaCell("で", "デ", "de"),
        KanaCell("ど", "ド", "do"),
    ),
    listOf(
        KanaCell("ば", "バ", "ba"),
        KanaCell("び", "ビ", "bi"),
        KanaCell("ぶ", "ブ", "bu"),
        KanaCell("べ", "ベ", "be"),
        KanaCell("ぼ", "ボ", "bo"),
    ),
    listOf(
        KanaCell("ぱ", "パ", "pa"),
        KanaCell("ぴ", "ピ", "pi"),
        KanaCell("ぷ", "プ", "pu"),
        KanaCell("ぺ", "ペ", "pe"),
        KanaCell("ぽ", "ポ", "po"),
    ),
)
