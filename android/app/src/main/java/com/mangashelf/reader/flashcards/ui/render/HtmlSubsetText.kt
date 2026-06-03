package com.mangashelf.reader.flashcards.ui.render

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.BaselineShift
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.em
import androidx.compose.material3.Text

/**
 * Renders parsed [HtmlBlock]s (the Definition field subset) natively in Compose — no WebView.
 * Furigana is approximated as a raised, smaller reading after the base (true stacked ruby is an
 * e-ink polish item, pooled to CH.11). Bold/italic become span styles; list items get a marker
 * gutter.
 */
@Composable
fun HtmlSubsetText(
    html: String,
    modifier: Modifier = Modifier,
    fontFamily: FontFamily? = null,
) {
    val blocks = remember(html) { HtmlSubset.parse(html) }
    Column(modifier) {
        for (block in blocks) {
            when (block) {
                is Para -> Text(block.inlines.toAnnotatedString(), fontFamily = fontFamily)
                is Item -> Row {
                    Text("${block.marker} ", fontFamily = fontFamily)
                    Text(block.inlines.toAnnotatedString(), fontFamily = fontFamily)
                }
            }
        }
    }
}

private fun List<HtmlInline>.toAnnotatedString(): AnnotatedString = buildAnnotatedString {
    for (inline in this@toAnnotatedString) {
        when (inline) {
            is Txt -> withStyle(
                SpanStyle(
                    fontWeight = if (inline.bold) FontWeight.Bold else null,
                    fontStyle = if (inline.italic) FontStyle.Italic else null,
                ),
            ) { append(inline.text) }

            is Furi -> {
                append(inline.base)
                withStyle(SpanStyle(fontSize = 0.6.em, baselineShift = BaselineShift.Superscript)) {
                    append(inline.reading)
                }
            }
        }
    }
}
