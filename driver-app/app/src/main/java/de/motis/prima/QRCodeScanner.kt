package de.motis.prima

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import android.media.Image
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.annotation.OptIn
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavController
import com.google.zxing.BarcodeFormat
import com.google.zxing.BinaryBitmap
import com.google.zxing.LuminanceSource
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.RGBLuminanceSource
import com.google.zxing.WriterException
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeReader
import com.google.zxing.qrcode.QRCodeWriter
import de.motis.prima.services.Api
import de.motis.prima.services.Event
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.ByteArrayOutputStream
import java.security.MessageDigest
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

data class Ticket(
    val hash: String,
    val code: String
)

class ScanViewModel : ViewModel() {
    private val _validTickets = MutableStateFlow(mutableMapOf<String, String>())
    val validTickets = _validTickets.asStateFlow()

    fun updateValidTickets(ticketCode: String) {
        _validTickets.value.put(md5(ticketCode), ticketCode)
    }

    private fun md5(input: String): String {
        val bytes = MessageDigest.getInstance("MD5").digest(input.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) } // Convert to hex string
    }

    fun reportTicketScan(requestId: Int, ticketCode: String) {
        Log.d("ticket", "Validating ticket code: $ticketCode")
        viewModelScope.launch {
            try {
                val response = Api.apiService.validateTicket(requestId, ticketCode)
                if (!response.success) {
                    Log.d("ticket", response.toString())
                }
            } catch (e: Exception) {
                Log.d("ticket", "Network Error: ${e.message!!}")
            }
        }
    }
}

class QRCodeScannerActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (!isCameraPermissionGranted()) {
            requestCameraPermission()
        }
    }

    private fun isCameraPermissionGranted(): Boolean {
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun requestCameraPermission() {
        ActivityCompat.requestPermissions(
            this,
            arrayOf(Manifest.permission.CAMERA),
            101
        )
    }
}

private fun imageProxyToBitmap(imageProxy: ImageProxy): Bitmap? {
    val yBuffer = imageProxy.planes[0].buffer // Y plane
    val uBuffer = imageProxy.planes[1].buffer // U plane
    val vBuffer = imageProxy.planes[2].buffer // V plane

    val ySize = yBuffer.remaining()
    val uSize = uBuffer.remaining()
    val vSize = vBuffer.remaining()

    // Allocate an array big enough to hold the YUV data
    val nv21 = ByteArray(ySize + uSize + vSize)

    // Copy the Y plane
    yBuffer.get(nv21, 0, ySize)

    // Copy the VU (V and U are interleaved in NV21 format)
    vBuffer.get(nv21, ySize, vSize)
    uBuffer.get(nv21, ySize + vSize, uSize)

    // Convert to YUVImage
    val yuvImage = YuvImage(nv21, ImageFormat.NV21, imageProxy.width, imageProxy.height, null)

    // Convert YUV to JPEG
    val out = ByteArrayOutputStream()
    yuvImage.compressToJpeg(
        Rect(0, 0, imageProxy.width, imageProxy.height), 100, out
    )

    // Convert the JPEG byte array to a Bitmap
    val jpegBytes = out.toByteArray()
    return BitmapFactory.decodeByteArray(jpegBytes, 0, jpegBytes.size).also {
        imageProxy.close() // Close the ImageProxy after processing
    }
}

private fun bitmapToBinaryBitmap(bitmap: Bitmap): BinaryBitmap {
    // Get the pixel data from the Bitmap
    val width = bitmap.width
    val height = bitmap.height
    val pixels = IntArray(width * height)
    bitmap.getPixels(pixels, 0, width, 0, 0, width, height)
    val source = RGBLuminanceSource(width, height, pixels)
    return BinaryBitmap(HybridBinarizer(source))
}

@OptIn(ExperimentalGetImage::class)
private fun processImageProxy_(imageProxy: ImageProxy, onQRCodeScanned: (String) -> Unit) {
    val mediaImage: Image? = imageProxy.image
    if (mediaImage != null && imageProxy.format == ImageFormat.YUV_420_888) {
        try {
            // Convert the ImageProxy to a LuminanceSource
            val buffer = mediaImage.planes[0].buffer
            val bytes = ByteArray(buffer.capacity())
            buffer.get(bytes)

            val width = mediaImage.width
            val height = mediaImage.height

            val source: LuminanceSource = PlanarYUVLuminanceSource(
                bytes, width, height, 0, 0, width, height, false
            )
            val binaryBitmap = BinaryBitmap(HybridBinarizer(source))

            val reader = QRCodeReader()
            val result = reader.decode(binaryBitmap)

            onQRCodeScanned(result.text)
        } catch (e: Exception) {
            Log.d("QRCodeScanner", "QR Code not found: ${e.message}")
        } finally {
            // Close the imageProxy to allow the next frame to be processed
            imageProxy.close()
        }
    } else {
        imageProxy.close()
    }
}

private fun processImageProxy(
    imageProxy: ImageProxy,
    onQRCodeScanned: (String) -> Unit
) {
    try {
        val bitmap = imageProxyToBitmap(imageProxy)
        if (bitmap != null) {
            Log.d("test", "Bitmap generated successfully!")

            val reader = QRCodeReader()
            val result = reader.decode(bitmapToBinaryBitmap(bitmap))

            onQRCodeScanned(result.text)
        }

    } catch (e: Exception) {
        Log.d("QRCodeScanner", "QR Code not found: ${e.message}")
    } finally {
        // Close the imageProxy to allow the next frame to be processed
        imageProxy.close()
    }
}

private fun setupQRCodeAnalyzer(
    onQRCodeScanned: (String) -> Unit,
    cameraExecutor: ExecutorService
): ImageAnalysis {
    return ImageAnalysis.Builder()
        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
        .build()
        .apply {
            setAnalyzer(cameraExecutor) { imageProxy: ImageProxy ->
                processImageProxy(imageProxy, onQRCodeScanned)
            }
        }
}

@Composable
fun QRCodeScanner(onQRCodeScanned: (String) -> Unit) {
    val cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()

    AndroidView(
        factory = { ctx ->
            val previewView = PreviewView(ctx)

            val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)
            cameraProviderFuture.addListener({
                val cameraProvider = cameraProviderFuture.get()

                // CameraX Preview
                val preview = Preview.Builder()
                    .build()
                    .also {
                        it.surfaceProvider = previewView.surfaceProvider
                    }

                val imageAnalysis = setupQRCodeAnalyzer(onQRCodeScanned, cameraExecutor)
                val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

                // Bind to Lifecycle
                try {
                    cameraProvider.unbindAll()
                    cameraProvider.bindToLifecycle(
                        (ctx as LifecycleOwner), cameraSelector, preview, imageAnalysis
                    )
                } catch (e: Exception) {
                    Log.e("QRCodeScanner", "Binding failed", e)
                }
            }, ContextCompat.getMainExecutor(ctx))

            previewView
        },
        modifier = Modifier.height(200.dp).width(200.dp)
    )
}

@Composable
fun ScanTicket(
    navController: NavController,
    tourId: Int,
    eventIndex: Int,
    viewModel: ScanViewModel
) {
    var isScanning by remember { mutableStateOf(true) }

    if (isScanning) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .width(300.dp)
                    .height(300.dp)
            ) {
                QRCodeScanner(
                    onQRCodeScanned = { result ->
                        viewModel.updateValidTickets(result)
                        isScanning = false
                    })
            }

            Spacer(modifier = Modifier.height(16.dp))

            Button(onClick = { navController.navigate("legs/$tourId/$eventIndex") }) {
                Text(text = "Zurück")
            }
        }
    } else {
        LaunchedEffect(Unit) {
            navController.navigate("legs/$tourId/$eventIndex")
        }
    }
}

// TEST
fun generateQRCodeBitmap(data: String): Bitmap? {
    return try {
        val writer = QRCodeWriter()
        val bitMatrix = writer.encode(data, BarcodeFormat.QR_CODE, 400, 400)
        val width = bitMatrix.width
        val height = bitMatrix.height
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.RGB_565)
        for (x in 0 until width) {
            for (y in 0 until height) {
                bitmap.setPixel(x, y, if (bitMatrix[x, y]) android.graphics.Color.BLACK else android.graphics.Color.WHITE)
            }
        }
        bitmap
    } catch (e: WriterException) {
        e.printStackTrace()
        null
    }
}

@Composable
fun GeneratedQRCode(data: String) {
    val qrCodeBitmap = remember(data) {
        generateQRCodeBitmap(data)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(text = "Generated QR Code", style = MaterialTheme.typography.headlineLarge)

        Spacer(modifier = Modifier.height(16.dp))

        qrCodeBitmap?.let { bitmap ->
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = "QR Code",
                modifier = Modifier.size(200.dp)
            )
        } ?: Text(text = "Failed to generate QR Code")
    }
}
