package de.motis.prima.app

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class DriversApp: Application()

/*class DriversApp: Application() {

    companion object {
        lateinit var instance: DriversApp
            private set
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
    }
}*/
