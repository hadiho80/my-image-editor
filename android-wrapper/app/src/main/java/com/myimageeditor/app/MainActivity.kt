package com.myimageeditor.app

import android.annotation.SuppressLint
import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import androidx.webkit.WebViewAssetLoader
import com.myimageeditor.app.databinding.ActivityMainBinding
import java.io.File

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private lateinit var assetLoader: WebViewAssetLoader

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        configureWebView(binding.webView)

        if (savedInstanceState == null) {
            binding.webView.loadUrl(APP_URL)
        }
    }

    private fun configureWebView(webView: WebView) {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            cacheMode = WebSettings.LOAD_DEFAULT
            mediaPlaybackRequiresUserGesture = false
            setSupportZoom(false)
        }

        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = LocalContentWebViewClient(assetLoader)
        webView.addJavascriptInterface(AndroidImageEditorBridge(), "AndroidImageEditor")
    }

    override fun onBackPressed() {
        if (binding.webView.canGoBack()) {
            binding.webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    private class LocalContentWebViewClient(
        private val assetLoader: WebViewAssetLoader,
    ) : WebViewClient() {
        override fun shouldInterceptRequest(
            view: WebView?,
            request: WebResourceRequest,
        ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)
    }

    private inner class AndroidImageEditorBridge {
        @JavascriptInterface
        fun saveImage(dataUrl: String, filename: String, mimeType: String) {
            runOnUiThread {
                try {
                    val bytes = decodeDataUrl(dataUrl)
                    val safeFilename = sanitizeFilename(filename)
                    val resolver = contentResolver
                    val values = ContentValues().apply {
                        put(MediaStore.Images.Media.DISPLAY_NAME, safeFilename)
                        put(MediaStore.Images.Media.MIME_TYPE, mimeType)
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/My Image Editor")
                            put(MediaStore.Images.Media.IS_PENDING, 1)
                        }
                    }
                    val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
                        ?: throw IllegalStateException("MediaStore tidak mengembalikan URI.")
                    resolver.openOutputStream(uri)?.use { it.write(bytes) }
                        ?: throw IllegalStateException("Tidak bisa membuka output galeri.")
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        values.clear()
                        values.put(MediaStore.Images.Media.IS_PENDING, 0)
                        resolver.update(uri, values, null, null)
                    }
                    Toast.makeText(this@MainActivity, "Gambar tersimpan ke Galeri", Toast.LENGTH_SHORT).show()
                } catch (error: Exception) {
                    Toast.makeText(this@MainActivity, "Gagal menyimpan gambar", Toast.LENGTH_LONG).show()
                }
            }
        }

        @JavascriptInterface
        fun shareImage(dataUrl: String, filename: String, mimeType: String) {
            runOnUiThread {
                try {
                    val bytes = decodeDataUrl(dataUrl)
                    val safeFilename = sanitizeFilename(filename)
                    val file = File(cacheDir, safeFilename)
                    file.writeBytes(bytes)
                    val uri: Uri = FileProvider.getUriForFile(
                        this@MainActivity,
                        "${packageName}.fileprovider",
                        file,
                    )
                    val intent = Intent(Intent.ACTION_SEND).apply {
                        type = mimeType
                        putExtra(Intent.EXTRA_STREAM, uri)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    startActivity(Intent.createChooser(intent, "Bagikan gambar"))
                } catch (error: Exception) {
                    Toast.makeText(this@MainActivity, "Gagal membagikan gambar", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun decodeDataUrl(dataUrl: String): ByteArray {
        val payload = dataUrl.substringAfter(",", "")
        if (payload.isBlank()) throw IllegalArgumentException("Data gambar kosong.")
        return Base64.decode(payload, Base64.DEFAULT)
    }

    private fun sanitizeFilename(filename: String): String {
        val safe = filename.replace(Regex("""[\\/:*?"<>|]+"""), "-").trim()
        return safe.ifBlank { "my-image-editor.png" }
    }

    companion object {
        private const val APP_URL = "https://appassets.androidplatform.net/assets/www/index.html"
    }
}
