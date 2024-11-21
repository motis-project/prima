package de.motis.prima.app

import android.app.Application

class DriversApp: Application() {

    companion object {
        lateinit var instance: DriversApp
            private set
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
    }
}
