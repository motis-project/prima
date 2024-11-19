package de.motis.prima.services

import de.motis.prima.BuildConfig
import de.motis.prima.app.DriversApp
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response

/**
 * The login api accepts only requests with the following headers set explicitly
 * This must be changed when CORS settings will be changed.
 */
fun okHttpClient() = OkHttpClient().newBuilder()
    .cookieJar(CookieStore(DriversApp.instance))
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
