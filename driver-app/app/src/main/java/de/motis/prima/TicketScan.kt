package de.motis.prima

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.util.Log
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.OptIn
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavController
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import de.motis.prima.services.Api
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.security.MessageDigest
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import android.provider.Settings
import android.net.Uri
import androidx.compose.foundation.layout.fillMaxWidth

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
                        viewModel.reportTicketScan(6, result)
                        isScanning = false
                    },
                    onCloseScanner = {
                        isScanning = false
                    },
                    navController
                )
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

@Composable
fun QRCodeScanner(
    onQRCodeScanned: (String) -> Unit,
    onCloseScanner: () -> Unit,
    navController: NavController,
) {
    val context = LocalContext.current
    var cameraProvider: ProcessCameraProvider? by remember { mutableStateOf(null) }
    val cameraProviderFuture = remember { ProcessCameraProvider.getInstance(context) }
    val executor: ExecutorService = remember { Executors.newSingleThreadExecutor() }
    var hasPermission by remember { mutableStateOf(false) }
    var showRationale by remember { mutableStateOf(false) }
    var permanentlyDenied by remember { mutableStateOf(false) }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        when {
            isGranted -> {
                hasPermission = true
                Toast.makeText(context, "Permission Granted", Toast.LENGTH_SHORT).show()
            }
            showRationale -> {
                Toast.makeText(context, "Permission Denied. You can enable it in settings.", Toast.LENGTH_LONG).show()
            }
            else -> {
                permanentlyDenied = true
            }
        }
    }

    // Check permission status
    LaunchedEffect(Unit) {
        when {
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED -> {
                hasPermission = true
            }
            else -> {
                showRationale = shouldShowRequestPermissionRationale(context, Manifest.permission.CAMERA)
            }
        }
    }

    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center) {
        when {
            showRationale -> {
                PermissionRationaleDialog(
                    onDismiss = { showRationale = false },
                    onRequestPermission = { permissionLauncher.launch(Manifest.permission.CAMERA) }
                )
            }
            permanentlyDenied -> {
                PermissionDeniedDialog(navController, context)
            }
            hasPermission -> {
                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = { ctx ->
                        val previewView = androidx.camera.view.PreviewView(ctx).apply {
                            scaleType = androidx.camera.view.PreviewView.ScaleType.FILL_CENTER
                        }

                        cameraProviderFuture.addListener({
                            val provider = cameraProviderFuture.get()
                            cameraProvider = provider

                            val preview = Preview.Builder().build().also {
                                it.surfaceProvider = previewView.surfaceProvider
                            }

                            val imageAnalyzer = ImageAnalysis.Builder().build().also {
                                it.setAnalyzer(executor) { imageProxy ->
                                    processImage(imageProxy, onQRCodeScanned, provider)
                                }
                            }

                            provider.unbindAll()
                            provider.bindToLifecycle(
                                ctx as ComponentActivity,
                                CameraSelector.DEFAULT_BACK_CAMERA,
                                preview,
                                imageAnalyzer
                            )
                        }, ContextCompat.getMainExecutor(ctx))

                        previewView
                    },
                    onRelease = {
                        cameraProvider?.unbindAll()
                        executor.shutdown()
                        onCloseScanner()
                    }
                )
            }
            else -> {
                Box (
                    modifier = Modifier.fillMaxWidth(),
                    contentAlignment = Alignment.Center
                ) {
                    Button(onClick = { permissionLauncher.launch(Manifest.permission.CAMERA) }) {
                        Text("Request Camera Permission")
                    }
                }
            }
        }
    }

    /*if (hasPermission) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                val previewView = androidx.camera.view.PreviewView(ctx).apply {
                    scaleType = androidx.camera.view.PreviewView.ScaleType.FILL_CENTER
                }

                cameraProviderFuture.addListener({
                    val provider = cameraProviderFuture.get()
                    cameraProvider = provider

                    val preview = Preview.Builder().build().also {
                        it.setSurfaceProvider(previewView.surfaceProvider)
                    }

                    val imageAnalyzer = ImageAnalysis.Builder().build().also {
                        it.setAnalyzer(executor) { imageProxy ->
                            processImage(imageProxy, onQRCodeScanned, provider)
                        }
                    }

                    provider.unbindAll()
                    provider.bindToLifecycle(
                        ctx as ComponentActivity,
                        CameraSelector.DEFAULT_BACK_CAMERA,
                        preview,
                        imageAnalyzer
                    )
                }, ContextCompat.getMainExecutor(ctx))

                previewView
            },
            onRelease = {
                cameraProvider?.unbindAll()
                executor.shutdown()
                onCloseScanner()
            }
        )
    } else {
        Text("Camera permission is required to scan QR codes.", modifier = Modifier.padding(16.dp))
    }*/
}

@OptIn(ExperimentalGetImage::class)
private fun processImage(
    imageProxy: ImageProxy,
    onQRCodeScanned: (String) -> Unit,
    cameraProvider: ProcessCameraProvider
) {
    val mediaImage = imageProxy.image ?: return
    val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)

    val scanner = BarcodeScanning.getClient(
        BarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
            .build()
    )

    scanner.process(image)
        .addOnSuccessListener { barcodes ->
            for (barcode in barcodes) {
                barcode.rawValue?.let { scannedValue ->
                    cameraProvider.unbindAll()
                    onQRCodeScanned(scannedValue)
                }
            }
        }
        .addOnFailureListener { e ->
            Log.e("error", "QR Code scanning failed", e)
        }
        .addOnCompleteListener {
            imageProxy.close()
        }
}

@Composable
fun PermissionRationaleDialog(onDismiss: () -> Unit, onRequestPermission: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Camera Permission Needed") },
        text = { Text("We need camera access to scan QR codes.") },
        confirmButton = {
            Button(onClick = onRequestPermission) { Text("Grant Permission") }
        },
        dismissButton = {
            Button(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

@Composable
fun PermissionDeniedDialog(navController: NavController, context: Context) {
    AlertDialog(
        onDismissRequest = {},
        title = { Text("Permission Denied") },
        text = { Text("Camera permission is permanently denied. Please enable it in settings.") },
        confirmButton = {
            Button(onClick = { openAppSettings(context) }) { Text("Open Settings") }
        },
        dismissButton = {
            Button(onClick = { navController.navigate("tours") }) { Text("Cancel") }
        }
    )
}

// Function to check if rationale should be shown
fun shouldShowRequestPermissionRationale(context: Context, permission: String): Boolean {
    return (context as? ComponentActivity)?.shouldShowRequestPermissionRationale(permission) ?: false
}

// Function to open app settings
fun openAppSettings(context: Context) {
    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
        data = Uri.fromParts("package", context.packageName, null)
    }
    context.startActivity(intent)
}
