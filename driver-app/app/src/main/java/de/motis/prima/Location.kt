package de.motis.prima

import android.util.Log
import androidx.lifecycle.ViewModel
import de.motis.prima.app.DriversApp

class LocationViewModel() : ViewModel() {
    private val locationUpdate = LocationUpdate.getInstance(DriversApp.instance)

    var currentLocation = Location(0.0, 0.0)

    private fun fetchLocation() {
        locationUpdate.getCurrentLocation { latitude, longitude ->
            if (latitude != null && longitude != null) {
                currentLocation = Location(latitude, longitude)
            } else {
                Log.d("location", "Unable to fetch location.")
            }
        }
    }

    init {
        fetchLocation()
    }
}