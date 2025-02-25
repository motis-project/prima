package de.motis.prima

import android.app.Application
import android.graphics.ImageFormat
import android.media.Image
import android.util.Log
import android.view.ViewGroup
import androidx.annotation.OptIn
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.livedata.observeAsState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.google.common.util.concurrent.ListenableFuture
import com.google.zxing.BinaryBitmap
import com.google.zxing.LuminanceSource
import com.google.zxing.NotFoundException
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.Result
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeReader
import de.motis.prima.services.Api
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.asExecutor
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.security.MessageDigest
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

data class Ticket(
    val requestId: Int,
    val hash: String,
    val code: String
)

class ScanViewModel : ViewModel() {
    private val _validTickets = MutableStateFlow(mutableMapOf<String, String>())
    val validTickets = _validTickets.asStateFlow()

    fun updateValidTickets(ticketCode: String) {
        _validTickets.value[md5(ticketCode)] = ticketCode
    }

    private fun md5(input: String): String {
        val bytes = MessageDigest.getInstance("MD5").digest(input.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
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

class CameraViewModel(application: Application) : AndroidViewModel(application) {
    private var _cameraProvider: MutableLiveData<ProcessCameraProvider?> = MutableLiveData(null)
    val cameraProvider: LiveData<ProcessCameraProvider?> get() = _cameraProvider

    private val cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()

    fun initializeCamera() {
        viewModelScope.launch(Dispatchers.IO) {
            val cameraProviderFuture: ListenableFuture<ProcessCameraProvider> =
                ProcessCameraProvider.getInstance(getApplication())

            cameraProviderFuture.addListener({
                _cameraProvider.postValue(cameraProviderFuture.get())
            }, Dispatchers.Main.asExecutor())
        }
    }

    private fun shutdownCamera() {
        _cameraProvider.value?.unbindAll()
        cameraExecutor.shutdown()
    }

    override fun onCleared() {
        super.onCleared()
        shutdownCamera()
    }

    @OptIn(ExperimentalGetImage::class)
    private fun processImageProxy(imageProxy: ImageProxy, onQRCodeScanned: (String) -> Unit) {
        val mediaImage: Image? = imageProxy.image

        if (mediaImage == null || imageProxy.format != ImageFormat.YUV_420_888) {
            imageProxy.close()
            return
        }

        imageProxy.use { _ ->
            val buffer = mediaImage.planes[0].buffer
            val bytes = ByteArray(buffer.capacity())
            buffer.get(bytes)
            val source: LuminanceSource = PlanarYUVLuminanceSource(
                bytes,
                mediaImage.width,
                mediaImage.height,
                0,
                0,
                mediaImage.width,
                mediaImage.height,
                false
            )

            val result = QRCodeProcessor().processImage(source)
            result?.text?.let { qrCodeText ->
                imageProxy.close()
                onQRCodeScanned(qrCodeText)
            }
        }
    }

    private fun setupQRCodeAnalyzer(
        onQRCodeScanned: (String) -> Unit
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

    fun startCamera(
        onQRCodeScanned: (String) -> Unit,
        cameraProvider: ProcessCameraProvider,
        lifecycleOwner: LifecycleOwner,
        previewView: PreviewView
    ) {
        val preview = Preview.Builder()
            .build()
            .also {
                it.surfaceProvider = previewView.surfaceProvider
            }

        val imageAnalysis = setupQRCodeAnalyzer(onQRCodeScanned)
        val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

        try {
            cameraProvider.unbindAll()
            cameraProvider.bindToLifecycle(lifecycleOwner, cameraSelector, preview, imageAnalysis)
        } catch (exc: Exception) {
            exc.printStackTrace()
        }
    }
}

class InvertedLuminanceSource(source: LuminanceSource) : LuminanceSource(source.width, source.height) {
    private val invertedPixels: ByteArray = ByteArray(source.width * source.height) {
        (255 - source.matrix[it]).toByte() // Invert pixel colors
    }

    override fun getRow(y: Int, row: ByteArray?): ByteArray {
        val newRow = row ?: ByteArray(width)
        System.arraycopy(invertedPixels, y * width, newRow, 0, width)
        return newRow
    }

    override fun getMatrix(): ByteArray = invertedPixels
}

class QRCodeProcessor {
    private val reader = QRCodeReader()

    fun processImage(source: LuminanceSource): Result? {
        return try {
            // First attempt (normal QR code)
            val bitmap = BinaryBitmap(HybridBinarizer(source))
            reader.decode(bitmap)
        } catch (e: NotFoundException) {
            try {
                // Second attempt (inverted QR code)
                val invertedSource = InvertedLuminanceSource(source)
                val invertedBitmap = BinaryBitmap(HybridBinarizer(invertedSource))
                reader.decode(invertedBitmap)
            } catch (ex: Exception) {
                null
            }
        } catch (e: Exception) {
            null
        }
    }
}

@Composable
fun QRCodeScanner(
    onQRCodeScanned: (String) -> Unit,
    cameraViewModel: CameraViewModel = viewModel()
) {
    val lifecycleOwner = LocalLifecycleOwner.current
    val cameraProvider by cameraViewModel.cameraProvider.observeAsState(null)

    LaunchedEffect(Unit) {
        cameraViewModel.initializeCamera()
    }

    if (cameraProvider != null) {
        AndroidView(
            factory = { ctx ->
                val previewView = PreviewView(ctx).apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                }
                previewView
            },
            modifier = Modifier.fillMaxSize(),
            update = { previewView ->
                cameraViewModel.startCamera(onQRCodeScanned, cameraProvider!!, lifecycleOwner, previewView)
            }
        )
    }
}

@Composable
fun TicketScan(
    navController: NavController,
    tourId: Int,
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

            Button(onClick = { navController.navigate("tours") }) {
                Text(text = stringResource(id = R.string.abort_scan))
            }
        }
    } else {
        LaunchedEffect(Unit) {
            navController.navigate("taxameter/$tourId")
        }
    }
}
