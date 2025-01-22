package de.motis.prima

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices

class LocationUpdate private constructor(private val context: Context) {

    private val fusedLocationClient: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(context)

    companion object {
        @Volatile
        private var INSTANCE: LocationUpdate? = null

        fun getInstance(context: Context): LocationUpdate {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: LocationUpdate(context.applicationContext).also { INSTANCE = it }
            }
        }
    }

    @SuppressLint("MissingPermission")
    fun getCurrentLocation(onLocationFetched: (latitude: Double?, longitude: Double?) -> Unit) {
        if (ActivityCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) != PackageManager.PERMISSION_GRANTED && ActivityCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            onLocationFetched(null, null)
            return
        }

        fusedLocationClient.lastLocation
            .addOnSuccessListener { location ->
                if (location != null) {
                    onLocationFetched(location.latitude, location.longitude)
                } else {
                    onLocationFetched(null, null)
                }
            }
            .addOnFailureListener {
                onLocationFetched(null, null)
            }
    }
}
