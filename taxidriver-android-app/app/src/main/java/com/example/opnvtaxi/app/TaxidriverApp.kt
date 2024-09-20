package com.example.opnvtaxi.app

import android.app.Application

class TaxidriverApp: Application() {

    companion object {
        lateinit var instance: TaxidriverApp
            private set
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
    }
}