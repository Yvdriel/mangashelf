package com.mangashelf.reader.dict.ui.render

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.Text
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
import com.mangashelf.dict.data.model.GlossaryNode
import com.mangashelf.dict.data.render.ListItem
import com.mangashelf.dict.data.render.Paragraph
import com.mangashelf.dict.data.render.Ruby
import com.mangashelf.dict.data.render.RenderInline
import com.mangashelf.dict.data.render.StructuredContentModel
import com.mangashelf.dict.data.render.TextRun

/**
 * D2.1 — renders a Yomitan glossary natively in Compose via [StructuredContentModel.flatten]
 * (no WebView). Furigana is a raised, smaller reading after the base (true stacked ruby is an
 * e-ink polish item, pooled to CH.11). Mirror of the flashcards `HtmlSubsetText`.
 */
@Composable
fun StructuredContentText(
    nodes: List<GlossaryNode>,
    modifier: Modifier = Modifier,
    fontFamily: FontFamily? = null,
) {
    val blocks = remember(nodes) { StructuredContentModel.flatten(nodes) }
    Column(modifier) {
        for (block in blocks) {
            when (block) {
                is Paragraph -> Text(block.inlines.toAnnotatedString(), fontFamily = fontFamily)
                is ListItem -> Row {
                    Text("${block.marker} ", fontFamily = fontFamily)
                    Text(block.inlines.toAnnotatedString(), fontFamily = fontFamily)
                }
            }
        }
    }
}

private fun List<RenderInline>.toAnnotatedString(): AnnotatedString = buildAnnotatedString {
    for (inline in this@toAnnotatedString) {
        when (inline) {
            is TextRun -> withStyle(
                SpanStyle(
                    fontWeight = if (inline.bold) FontWeight.Bold else null,
                    fontStyle = if (inline.italic) FontStyle.Italic else null,
                ),
            ) { append(inline.text) }

            is Ruby -> {
                append(inline.base)
                withStyle(SpanStyle(fontSize = 0.6.em, baselineShift = BaselineShift.Superscript)) {
                    append(inline.reading)
                }
            }
        }
    }
}
