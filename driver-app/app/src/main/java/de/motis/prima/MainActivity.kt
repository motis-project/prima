package de.motis.prima

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import com.google.firebase.FirebaseApp
import dagger.hilt.android.AndroidEntryPoint

// Light Theme Colors
private val LightColorScheme = lightColorScheme(
    primary = Color(0xFF6200EE),
    onPrimary = Color.White,
    background = Color.White,
    onBackground = Color.Black
)

// Dark Theme Colors
private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFFBB86FC),
    onPrimary = Color.Black,
    background = Color.Black,
    onBackground = Color.White
)

@Composable
fun MyAppTheme(
    darkTheme: Boolean = true,//isSystemInDarkTheme(), // Detect system theme
    content: @Composable () -> Unit
) {
    val colors = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colors,
        //typography = Typography, // Optional: Define custom typography
        content = content
    )
}

@AndroidEntryPoint
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        FirebaseApp.initializeApp(this)
        requestPermissions()
        setContent { Nav(intent)  }
    }

    override fun onNewIntent(intent: Intent?) { // TODO: is never called
        super.onNewIntent(intent)
        // Handle when activity is already running
        Log.d("intent", "MainActivity: Received intent")
        intent?.let {
            Log.d("intent", "Running MainActivity received: ${intent.getStringExtra("tourId")}")
        }
    }

    private val permissionsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions[Manifest.permission.POST_NOTIFICATIONS] ?: false
        }

        /*permissions[Manifest.permission.ACCESS_COARSE_LOCATION] ?: false
        permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        val cameraGranted = permissions[Manifest.permission.CAMERA] ?: false

        if (cameraGranted) {
            //setContent { MyAppTheme { Nav() } }
            setContent { Nav(intent)  }
        } else {
            setContent { PermissionInfo() }
        }*/
    }

    private fun requestPermissions() {
        val permissionsToRequest = mutableListOf(
            //Manifest.permission.ACCESS_COARSE_LOCATION,
            //Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.CAMERA
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissionsToRequest.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        permissionsLauncher.launch(permissionsToRequest.toTypedArray())
    }
}
