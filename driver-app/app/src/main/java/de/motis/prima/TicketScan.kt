package de.motis.prima

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
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
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Done
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import de.motis.prima.viewmodel.ScanViewModel
import kotlinx.coroutines.delay
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

@Composable
fun TicketScan(
    navController: NavController,
    eventGroupId: String,
    viewModel: ScanViewModel = hiltViewModel()
) {
    Scaffold(
        topBar = {
            TopBar(
                "   Scan Ticket Code",
                false,
                emptyList<NavItem>(),
                navController
            )
        }
    ) { contentPadding ->
        var isScanning by remember { mutableStateOf(true) }
        var ticketValid by remember { mutableStateOf(false) }
        var showDialog by remember { mutableStateOf(false) }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(contentPadding),
            verticalArrangement = Arrangement.SpaceBetween,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .width(300.dp)
                    .height(300.dp)
                    .padding(top = 200.dp),
                contentAlignment = Alignment.Center
            ) {
                if (isScanning) {
                    QRCodeScanner(
                        onQRCodeScanned = { result ->
                            val eventGroup = viewModel.getEventGroup(eventGroupId)
                            val activeHash = viewModel.getActiveHash(result)

                            // does eventGroup contain the ticketHash?
                            if (eventGroup != null) {
                                val event =
                                    eventGroup.events.find { e -> e.ticketHash == activeHash }
                                if (event != null) {
                                    ticketValid = true
                                    viewModel.reportTicketScan(event.requestId, event.ticketHash, result)
                                }
                            }
                            isScanning = false
                        },
                        navController
                    )
                } else {

                    if (ticketValid) {
                        Icon(
                            imageVector = Icons.Default.Done,
                            contentDescription = "Localized description",
                            tint = Color.Green,
                            modifier = Modifier.size(64.dp)

                        )
                        LaunchedEffect(Unit) {
                            delay(500)
                            navController.popBackStack()
                        }
                    } else {
                        /*Icon(
                            imageVector = Icons.Default.Clear,
                            contentDescription = "Localized description",
                            tint = Color.Red,
                            modifier = Modifier.size(64.dp)

                        )*/
                        showDialog = true
                    }
                }
            }

            if (showDialog) {
                AlertDialog(
                    onDismissRequest = { showDialog = false },
                    title = { Text("Ticket ungültig") },
                    //text = { Text("Beförderung zum normalen Taxi-Tarif") },
                    icon = {Icon(
                        imageVector = Icons.Default.Clear,
                        contentDescription = "Localized description",
                        tint = Color.Red,
                        modifier = Modifier.size(64.dp)

                    )},
                    confirmButton = {
                        Button(onClick = {
                            showDialog = false
                            navController.popBackStack()
                        }) {
                            Text("Ok")
                        }
                    },
                    /*dismissButton = {
                        Button(onClick = { showDialog = false }) {
                            Text("Nein")
                        }
                    }*/
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth().height(110.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Button(
                    onClick = {
                        navController.popBackStack()
                    }
                ) {
                    Text(
                        text = "Zurück",
                        fontSize = 24.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}

@Composable
fun QRCodeScanner(
    onQRCodeScanned: (String) -> Unit,
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
                Toast.makeText(context, "Erlaubnis erteilt.", Toast.LENGTH_SHORT).show()
            }

            showRationale -> {
                Toast.makeText(
                    context,
                    "Erlaubnis verwehrt. Sie können dies in den Systemeinstellungen ändern",
                    Toast.LENGTH_LONG
                ).show()
            }

            else -> {
                permanentlyDenied = true
            }
        }
    }

    LaunchedEffect(Unit) {
        when {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.CAMERA
            ) == PackageManager.PERMISSION_GRANTED -> {
                hasPermission = true
            }

            else -> {
                showRationale =
                    shouldShowRequestPermissionRationale(context, Manifest.permission.CAMERA)
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

            /*permanentlyDenied -> {
                PermissionDeniedDialog(navController, context)
            }*/

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
                    }
                )
            }

            else -> {
                Box(
                    modifier = Modifier.fillMaxWidth(),
                    contentAlignment = Alignment.Center
                ) {
                    Button(onClick = { permissionLauncher.launch(Manifest.permission.CAMERA) }) {
                        Text("Erlaubnis zur Verwendung der Kamera erfragen")
                    }
                }
            }
        }
    }
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
            Log.e("error", "Scan des QR-Codes fehlgeschlagen", e)
        }
        .addOnCompleteListener {
            imageProxy.close()
        }
}

@Composable
fun PermissionRationaleDialog(onDismiss: () -> Unit, onRequestPermission: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Erlaubnis zur Verwendung der Kamera wird benötigt") },
        text = { Text("Die App benötigt den Zugriff auf die Kamera zum scannen von QR-Codes.") },
        confirmButton = {
            Button(onClick = onRequestPermission) { Text("Grant Permission") }
        },
        dismissButton = {
            Button(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

/*@Composable
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
}*/

// Function to check if rationale should be shown
fun shouldShowRequestPermissionRationale(context: Context, permission: String): Boolean {
    return (context as? ComponentActivity)?.shouldShowRequestPermissionRationale(permission)
        ?: false
}

// Function to open app settings
fun openAppSettings(context: Context) {
    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
        data = Uri.fromParts("package", context.packageName, null)
    }
    context.startActivity(intent)
}
