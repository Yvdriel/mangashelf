package com.mangashelf.reader.data.store

import org.junit.Assert.assertEquals
import org.junit.Test

/** Guards [normalizeServerUrl]: it must yield a scheme://host[:port] origin so the onboarding
 * validator and the host/port-only AuthInterceptor agree (Copilot PR#17 finding). */
class ServerUrlTest {

    @Test
    fun prefixesHttpWhenSchemeMissing() =
        assertEquals("http://10.0.2.2:3200", normalizeServerUrl("10.0.2.2:3200"))

    @Test
    fun trimsTrailingSlash() =
        assertEquals("http://host:3000", normalizeServerUrl("http://host:3000/"))

    @Test
    fun stripsPathQueryAndFragment() =
        assertEquals("http://example.com", normalizeServerUrl("example.com/foo/bar?x=1#y"))

    @Test
    fun dropsDefaultHttpsPort() =
        assertEquals("https://srv.example", normalizeServerUrl("https://srv.example:443/path"))

    @Test
    fun keepsNonDefaultPort() =
        assertEquals("https://srv.example:8443", normalizeServerUrl("https://srv.example:8443"))

    @Test
    fun trimsSurroundingWhitespace() =
        assertEquals("http://10.0.2.2:3200", normalizeServerUrl("  10.0.2.2:3200  "))
}
