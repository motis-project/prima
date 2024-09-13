package com.example.opnvtaxi.services

import com.example.opnvtaxi.BuildConfig
import com.example.opnvtaxi.app.TaxidriverApp
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response

/**
 * 09.09.24: The login api accepts only requests with the following headers set explicitly
 * This must be changed when CORS settings will be changed.
 *
 * How to write an interceptor for Kotlin:
 * https://medium.com/@1550707241489/how-to-add-headers-to-retrofit-android-kotlin-450da34d3c3a
 */
fun okHttpClient() = OkHttpClient().newBuilder()
    .cookieJar(CookieStore(TaxidriverApp.instance))
    .addInterceptor(
        object : Interceptor {
            override fun intercept(chain: Interceptor.Chain): Response {
                val request: Request = chain.request()
                    .newBuilder()
                    .header("x-sveltekit-action", "true")
                    .header("Origin", BuildConfig.BASE_URL)
                    .build()
                return chain.proceed(request)
            }
        }
    )