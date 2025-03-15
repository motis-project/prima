package de.motis.prima

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        requestPermissions()
    }

    private val permissionsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions[Manifest.permission.POST_NOTIFICATIONS] ?: false
        }

        //permissions[Manifest.permission.ACCESS_COARSE_LOCATION] ?: false
        //permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        val cameraGranted = permissions[Manifest.permission.CAMERA] ?: false

        if (cameraGranted) {
            setContent { Nav() }
        }
    }

    private fun requestPermissions() {
        val permissionsToRequest = mutableListOf(
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.CAMERA
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissionsToRequest.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        permissionsLauncher.launch(permissionsToRequest.toTypedArray())
    }
}
