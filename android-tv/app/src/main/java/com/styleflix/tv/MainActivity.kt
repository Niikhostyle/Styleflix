package com.styleflix.tv

import android.annotation.SuppressLint
import android.graphics.Color
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import java.io.ByteArrayInputStream
import java.nio.charset.StandardCharsets
import java.util.Locale

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }

        webView = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            isFocusable = true
            isFocusableInTouchMode = true
            requestFocus(View.FOCUS_DOWN)
        }
        setContentView(webView)

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            userAgentString = "$userAgentString VeoTV/1.0"
            cacheMode = WebSettings.LOAD_DEFAULT
            loadWithOverviewMode = true
            useWideViewPort = true
            builtInZoomControls = false
            displayZoomControls = false
            setSupportZoom(false)
            allowFileAccess = false
            javaScriptCanOpenWindowsAutomatically = false
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                val url = request?.url?.toString().orEmpty()
                if (shouldBlockAd(url)) {
                    return emptyAdResponse()
                }
                return super.shouldInterceptRequest(view, request)
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val url = request?.url?.toString().orEmpty()
                if (shouldBlockAd(url)) return true
                return false
            }
        }
        webView.webChromeClient = WebChromeClient()

        val startUrl = getString(R.string.styleflix_url)
        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            webView.loadUrl(startUrl)
        }

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (webView.canGoBack()) webView.goBack() else finish()
                }
            }
        )
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        webView.requestFocus()
    }

    override fun onPause() {
        webView.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (webView.dispatchKeyEvent(event)) return true
        return super.dispatchKeyEvent(event)
    }

    companion object {
        private val BLOCKED =
            listOf(
                "doubleclick.net",
                "googlesyndication.com",
                "googleadservices.com",
                "googletagservices.com",
                "imasdk.googleapis.com",
                "pagead2.googlesyndication.com",
                "fundingchoicesmessages.google.com",
                "amazon-adsystem.com",
                "adsystem.amazon",
                "adnxs.com",
                "adsrvr.org",
                "moatads.com",
                "pubmatic.com",
                "rubiconproject.com",
                "openx.net",
                "criteo.com",
                "exoclick.com",
                "juicyads.com",
                "popads.net",
                "propellerads.com",
                "adsterra.com",
                "hilltopads.com",
                "trafficjunky.net",
                "tsyndicate.com",
                "/vast",
                "/vmap",
                "ima3.js",
                "preroll",
                "midroll",
            )

        private fun shouldBlockAd(url: String): Boolean {
            if (url.isBlank()) return false
            val lower = url.lowercase(Locale.US)
            if (lower.contains("vimeus.com") ||
                lower.contains("cloudmusic.cl") ||
                lower.contains("mublackstar.cl") ||
                lower.contains("themoviedb.org") ||
                lower.contains("image.tmdb.org")
            ) {
                return lower.contains("imasdk.googleapis.com")
            }
            return BLOCKED.any { lower.contains(it) }
        }

        private fun emptyAdResponse(): WebResourceResponse =
            WebResourceResponse(
                "text/plain",
                StandardCharsets.UTF_8.name(),
                ByteArrayInputStream(ByteArray(0))
            )
    }
}
